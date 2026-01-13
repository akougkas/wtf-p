#!/usr/bin/env node

const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { 
  CallToolRequestSchema, 
  ListToolsRequestSchema,
  ErrorCode,
  McpError 
} = require("@modelcontextprotocol/sdk/types.js");
const fetch = require("node-fetch");

const SEMANTIC_SCHOLAR_API = "https://api.semanticscholar.org/graph/v1";

class ResearchServer {
  constructor() {
    this.server = new Server(
      {
        name: "wtf-p-research",
        version: "0.4.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupTools();
    
    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on("SIGINT", async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupTools() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: "search_papers",
          description: "Search for academic papers on Semantic Scholar",
          inputSchema: {
            type: "object",
            properties: {
              query: { type: "string", description: "Search query (title, authors, keywords)" },
              limit: { type: "number", description: "Max results (default 5)", default: 5 },
            },
            required: ["query"],
          },
        },
        {
          name: "get_bibtex",
          description: "Get BibTeX for a specific paper by its Semantic Scholar ID or DOI",
          inputSchema: {
            type: "object",
            properties: {
              paperId: { type: "string", description: "Semantic Scholar ID or DOI (prefix with 'DOI:')" },
            },
            required: ["paperId"],
          },
        },
      ],
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      switch (request.params.name) {
        case "search_papers":
          return await this.handleSearch(request.params.arguments);
        case "get_bibtex":
          return await this.handleGetBibtex(request.params.arguments);
        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
      }
    });
  }

  async handleSearch(args) {
    const { query, limit = 5 } = args;
    try {
      const response = await fetch(
        `${SEMANTIC_SCHOLAR_API}/paper/search?query=${encodeURIComponent(query)}&limit=${limit}&fields=title,authors,year,abstract,venue,externalIds`
      );
      if (!response.ok) throw new Error(`API error: ${response.statusText}`);
      const data = await response.json();
      
      return {
        content: [{ type: "text", text: JSON.stringify(data.data || [], null, 2) }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error searching papers: ${error.message}` }],
        isError: true,
      };
    }
  }

  async handleGetBibtex(args) {
    const { paperId } = args;
    try {
      // In a real implementation, we might need a separate service or to construct BibTeX from the metadata
      // For this prototype, we'll fetch the fields needed to construct a valid BibTeX entry.
      const response = await fetch(
        `${SEMANTIC_SCHOLAR_API}/paper/${paperId}?fields=title,authors,year,venue,externalIds,citationStyles`
      );
      if (!response.ok) throw new Error(`API error: ${response.statusText}`);
      const data = await response.json();
      
      const authors = (data.authors || []).map(a => a.name).join(' and ');
      const bibtex = `@article{${data.externalIds?.DOI || data.paperId},\n  title={${data.title}},\n  author={${authors}},\n  journal={${data.venue || 'Unknown'}},\n  year={${data.year}}
}`;

      return {
        content: [{ type: "text", text: bibtex }],
      };
    } catch (error) {
      return {
        content: [{ type: "text", text: `Error fetching BibTeX: ${error.message}` }],
        isError: true,
      };
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error("Research MCP server running on stdio");
  }
}

const server = new ResearchServer();
server.run().catch(console.error);
