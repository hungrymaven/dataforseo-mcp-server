import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { DataForSeoClient } from "./client.js";
import { DataForSeoResponse, TaskReadyResponse, TaskGetResponse } from "./types.js";

interface RequestHandlerExtra {
  args: any;
  client: DataForSeoClient;
}

/**
 * Base helper function to register an MCP tool for DataForSEO API
 */
export function registerTool(
  server: McpServer,
  name: string,
  schema: z.ZodObject<any> | z.ZodEffects<any>,
  handler: (params: z.infer<typeof schema>, client: DataForSeoClient) => Promise<any>
) {
  server.tool(
    name,
    'shape' in schema ? schema.shape : schema,
    (args: any, extra: RequestHandlerExtra) => {
      return handler(args, extra.client)
        .then(result => ({
          content: [
            {
              type: "text",
              text: JSON.stringify(result, null, 2)
            }
          ]
        }))
        .catch(error => {
          console.error(`Error in ${name} tool:`, error);
          return {
            content: [{
              type: "text",
              text: JSON.stringify({
                error: error instanceof Error ? error.message : "Unknown error occurred",
                stack: error instanceof Error ? error.stack : undefined
              }, null, 2)
            }]
          };
        });
    }
  );
}

/**
 * Helper for registering a task-based tool (POST, READY, GET pattern)
 */
export function registerTaskTool(
  server: McpServer,
  name: string,
  postSchema: z.ZodObject<any>,
  getSchema: z.ZodObject<any>,
  postHandler: (params: any, client: DataForSeoClient) => Promise<any>
) {
  // Register POST endpoint
  registerTool(server, `${name}_post`, postSchema, postHandler);
  
  // Register READY endpoint
  registerTool(
    server,
    `${name}_ready`,
    z.object({}),
    async (_params, client) => {
      const response = await client.get(`/serp/google/organic/tasks_ready`) as DataForSeoResponse<TaskReadyResponse>;
      return response;
    }
  );
  
  // Register GET endpoint
  registerTool(
    server,
    `${name}_get`,
    getSchema,
    async (params, client) => {
      const response = await client.get(`/serp/google/organic/task_get/${params.id}`) as DataForSeoResponse<TaskGetResponse<any>>;
      return response;
    }
  );
}