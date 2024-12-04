import type { CanvasConfig } from '../types/canvas.js';
import { CanvasAPI } from '../services/canvasAPI.js';
export declare function createCanvasMCPServer(config: CanvasConfig): any;
export declare function createHandlers(canvasAPI: CanvasAPI): {
    handleListResources(request: ListResourcesRequest): Promise<{
        resources: {
            uri: string;
            name: string;
            metadata: ResourceMetadata;
        }[];
    }>;
    handleReadResource(request: ReadResourceRequest): Promise<{
        contents: unknown;
    }>;
    handleSearchResources(request: SearchResourcesRequest): Promise<{
        resources: {
            uri: string;
            name: string;
            metadata: ResourceMetadata;
        }[];
    }>;
    class: any;
};
