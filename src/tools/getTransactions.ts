/**
 * @file Get Transactions Tool
 * @version 1.0.0
 * @description Implementation of the get_transactions tool for the Brex MCP server
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { BrexClient } from "../services/brex/client.js";
import { logDebug, logError } from "../utils/logger.js";
import { isBrexTransaction } from "../services/brex/types.js";
import { registerToolHandler } from "./index.js";

// Get Brex client
function getBrexClient(): BrexClient {
  return new BrexClient();
}

/**
 * Interface for get_transactions tool input parameters
 */
interface GetTransactionsParams {
  accountId: string;
  limit?: number;
}

/**
 * Validates and processes the get_transactions tool parameters
 * @param input The raw input parameters from the tool call
 * @returns Validated parameters
 */
function validateParams(input: any): GetTransactionsParams {
  if (!input) {
    throw new Error("Missing parameters");
  }
  
  if (!input.accountId) {
    throw new Error("Missing required parameter: accountId");
  }
  
  const params: GetTransactionsParams = {
    accountId: input.accountId
  };
  
  // Add optional parameters if provided
  if (input.limit !== undefined) {
    const limit = parseInt(input.limit.toString(), 10);
    if (isNaN(limit) || limit <= 0) {
      throw new Error("Invalid limit: must be a positive number");
    }
    params.limit = limit;
  }
  
  return params;
}

/**
 * Registers the get_transactions tool with the server
 * @param server The MCP server instance
 */
export function registerGetTransactions(server: Server): void {
  registerToolHandler("get_transactions", async (request) => {
    try {
      // Validate parameters
      const params = validateParams(request.params.input);
      logDebug(`Getting transactions for account ${params.accountId}`);
      
      // Get Brex client
      const brexClient = getBrexClient();
      
      // Set default limit if not provided
      const limit = params.limit || 50;
      
      try {
        // Call Brex API to get transactions
        const transactions = await brexClient.getTransactions(params.accountId, JSON.stringify({ limit }));
        
        // Validate transactions data
        if (!transactions || !Array.isArray(transactions.items)) {
          throw new Error("Invalid response format from Brex API");
        }
        
        // Filter valid transactions
        const validTransactions = transactions.items.filter(isBrexTransaction);
        logDebug(`Found ${validTransactions.length} valid transactions out of ${transactions.items.length} total`);
        
        return {
          content: [{
            type: "text",
            text: JSON.stringify(validTransactions, null, 2)
          }]
        };
      } catch (apiError) {
        logError(`Error calling Brex API: ${apiError instanceof Error ? apiError.message : String(apiError)}`);
        throw new Error(`Failed to get transactions: ${apiError instanceof Error ? apiError.message : String(apiError)}`);
      }
    } catch (error) {
      logError(`Error in get_transactions tool: ${error instanceof Error ? error.message : String(error)}`);
      throw error;
    }
  });
} 