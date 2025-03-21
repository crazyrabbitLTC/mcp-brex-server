/**
 * @file Cash Accounts Resource Handler
 * @version 1.0.0
 * @description Handles Brex cash accounts resource requests
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { ReadResourceRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { ResourceTemplate } from "../models/resourceTemplate.js";
import { logDebug, logError } from "../utils/logger.js";
import { BrexClient } from "../services/brex/client.js";
import { isCashAccount, isStatement } from "../services/brex/transactions-types.js";

// Get Brex client
function getBrexClient(): BrexClient {
  return new BrexClient();
}

// Define resource templates
const cashAccountsTemplate = new ResourceTemplate("brex://accounts/cash{/id}");
const cashAccountsStatementsTemplate = new ResourceTemplate("brex://accounts/cash/{id}/statements");
const primaryCashAccountTemplate = new ResourceTemplate("brex://accounts/cash/primary");

/**
 * Registers the cash accounts resource handler with the server
 * @param server The MCP server instance
 */
export function registerCashAccountsResource(server: Server): void {
  server.registerCapabilities({
    resources: {
      "brex://accounts/cash{/id}": {
        description: "Brex cash accounts",
        mimeTypes: ["application/json"],
      },
      "brex://accounts/cash/primary": {
        description: "Brex primary cash account",
        mimeTypes: ["application/json"],
      },
      "brex://accounts/cash/{id}/statements": {
        description: "Brex cash account statements",
        mimeTypes: ["application/json"],
      }
    }
  });

  // Use the standard approach with setRequestHandler
  server.setRequestHandler(ReadResourceRequestSchema, async (request, extra) => {
    const uri = request.params.uri;
    
    // Check if this handler should process this URI
    if (!uri.startsWith("brex://accounts/cash")) {
      return { handled: false }; // Not handled by this handler
    }
    
    logDebug(`Reading cash account resource: ${uri}`);
    
    // Get Brex client
    const brexClient = getBrexClient();
    
    // Primary cash account endpoint
    if (uri.includes("cash/primary") && !uri.includes("statements")) {
      try {
        logDebug("Fetching primary cash account from Brex API");
        const account = await brexClient.getPrimaryCashAccount();
        
        // Validate account
        if (!isCashAccount(account)) {
          logError(`Invalid primary cash account data received: ${JSON.stringify(account)}`);
          throw new Error('Invalid primary cash account data received');
        }
        
        logDebug(`Successfully fetched primary cash account`);
        return {
          contents: [{
            uri: uri,
            mimeType: "application/json",
            text: JSON.stringify(account, null, 2)
          }]
        };
      } catch (error) {
        logError(`Failed to fetch primary cash account: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    }
    
    // Handle statements endpoint
    if (uri.includes("/statements")) {
      const statementsParams = cashAccountsStatementsTemplate.parse(uri);
      
      if (!statementsParams.id) {
        return {
          error: {
            message: "Account ID is required for statements endpoint",
            code: 400
          }
        };
      }
      
      // Extract cursor and limit from query parameters
      const url = new URL(uri);
      const cursor = url.searchParams.get("cursor") || undefined;
      const limit = url.searchParams.get("limit") ? parseInt(url.searchParams.get("limit") as string, 10) : undefined;
      
      try {
        logDebug(`Fetching statements for cash account ${statementsParams.id} from Brex API`);
        const statements = await brexClient.getCashAccountStatements(statementsParams.id, cursor, limit);
        
        // Validate statements
        if (!statements.items || !Array.isArray(statements.items)) {
          throw new Error('Invalid statements data received');
        }
        
        for (const statement of statements.items) {
          if (!isStatement(statement)) {
            logError(`Invalid statement data received: ${JSON.stringify(statement)}`);
            throw new Error('Invalid statement data received');
          }
        }
        
        logDebug(`Successfully fetched ${statements.items.length} statements for cash account ${statementsParams.id}`);
        
        // Format response with pagination information
        const result = {
          items: statements.items,
          pagination: {
            hasMore: !!statements.next_cursor,
            nextCursor: statements.next_cursor
          }
        };
        
        return {
          contents: [{
            uri: uri,
            mimeType: "application/json",
            text: JSON.stringify(result, null, 2)
          }]
        };
      } catch (error) {
        logError(`Failed to fetch cash account statements: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    }
    
    // Handle regular cash accounts endpoint
    const params = cashAccountsTemplate.parse(uri);
    
    if (!params.id) {
      // List all cash accounts
      try {
        logDebug("Fetching all cash accounts from Brex API");
        const accounts = await brexClient.getCashAccounts();
        
        // Validate accounts
        if (!accounts.items || !Array.isArray(accounts.items)) {
          throw new Error('Invalid cash accounts data received');
        }
        
        for (const account of accounts.items) {
          if (!isCashAccount(account)) {
            logError(`Invalid cash account data received: ${JSON.stringify(account)}`);
            throw new Error('Invalid cash account data received');
          }
        }
        
        logDebug(`Successfully fetched ${accounts.items.length} cash accounts`);
        
        // Format response with pagination information
        const result = {
          items: accounts.items,
          pagination: {
            hasMore: !!accounts.next_cursor,
            nextCursor: accounts.next_cursor
          }
        };
        
        return {
          contents: [{
            uri: uri,
            mimeType: "application/json",
            text: JSON.stringify(result, null, 2)
          }]
        };
      } catch (error) {
        logError(`Failed to fetch cash accounts: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    } else {
      // Get specific cash account by ID
      try {
        logDebug(`Fetching cash account ${params.id} from Brex API`);
        const account = await brexClient.getCashAccountById(params.id);
        
        // Validate account
        if (!isCashAccount(account)) {
          logError(`Invalid cash account data received for account ID: ${params.id}`);
          throw new Error('Invalid cash account data received');
        }
        
        logDebug(`Successfully fetched cash account ${params.id}`);
        return {
          contents: [{
            uri: uri,
            mimeType: "application/json",
            text: JSON.stringify(account, null, 2)
          }]
        };
      } catch (error) {
        logError(`Failed to fetch cash account ${params.id}: ${error instanceof Error ? error.message : String(error)}`);
        throw error;
      }
    }
  });
} 