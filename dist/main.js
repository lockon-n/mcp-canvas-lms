import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ListResourcesRequestSchema, ReadResourceRequestSchema, SearchResourcesRequestSchema, WatchResourcesRequestSchema, ResourceUpdateMessage } from "@modelcontextprotocol/sdk/schema/index.js";
import axios from "axios";
class CanvasAPI {
    constructor(baseURL, accessToken) {
        this.api = axios.create({
            baseURL,
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        });
    }
    // Course Methods
    async listCourses(include = []) {
        try {
            const response = await this.api.get('/api/v1/courses', {
                params: { include: include.join(',') }
            });
            return response.data;
        }
        catch (error) {
            throw this.handleError('Failed to list courses', error);
        }
    }
    async getCourse(courseId, include = []) {
        try {
            const response = await this.api.get(`/api/v1/courses/${courseId}`, {
                params: { include: include.join(',') }
            });
            return response.data;
        }
        catch (error) {
            throw this.handleError(`Failed to get course ${courseId}`, error);
        }
    }
    // Module Methods
    async listModules(courseId, include = []) {
        try {
            const response = await this.api.get(`/api/v1/courses/${courseId}/modules`, {
                params: { include: include.join(',') }
            });
            return response.data;
        }
        catch (error) {
            throw this.handleError(`Failed to list modules for course ${courseId}`, error);
        }
    }
    async getModuleItems(courseId, moduleId) {
        try {
            const response = await this.api.get(`/api/v1/courses/${courseId}/modules/${moduleId}/items`);
            return response.data;
        }
        catch (error) {
            throw this.handleError(`Failed to get items for module ${moduleId}`, error);
        }
    }
    // Assignment Methods
    async listAssignments(courseId, include = []) {
        try {
            const response = await this.api.get(`/api/v1/courses/${courseId}/assignments`, {
                params: { include: include.join(',') }
            });
            return response.data;
        }
        catch (error) {
            throw this.handleError(`Failed to list assignments for course ${courseId}`, error);
        }
    }
    async getAssignment(courseId, assignmentId, include = []) {
        try {
            const response = await this.api.get(`/api/v1/courses/${courseId}/assignments/${assignmentId}`, { params: { include: include.join(',') } });
            return response.data;
        }
        catch (error) {
            throw this.handleError(`Failed to get assignment ${assignmentId}`, error);
        }
    }
    // Submission Methods
    async listSubmissions(courseId, assignmentId, include = []) {
        try {
            const response = await this.api.get(`/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`, { params: { include: include.join(',') } });
            return response.data;
        }
        catch (error) {
            throw this.handleError(`Failed to list submissions for assignment ${assignmentId}`, error);
        }
    }
    // Grade Methods
    async getGrades(courseId, studentId) {
        try {
            const response = await this.api.get(`/api/v1/courses/${courseId}/students/${studentId}/grades`);
            return response.data;
        }
        catch (error) {
            throw this.handleError(`Failed to get grades for student ${studentId}`, error);
        }
    }
    handleError(message, error) {
        console.error(`Canvas API Error: ${message}`, error.response?.data || error);
        return new Error(`${message}: ${error.response?.data?.errors?.[0]?.message || error.message}`);
    }
}
class CanvasMCPServer {
    constructor(canvasURL, accessToken) {
        this.canvasAPI = new CanvasAPI(canvasURL, accessToken);
        this.watchedResources = new Map();
        this.pollInterval = 30000; // 30 seconds
        this.server = new Server({
            name: "canvas-lms-server",
            version: "1.0.0",
        }, {
            capabilities: {
                resources: {
                    courses: true,
                    modules: true,
                    assignments: true,
                    submissions: true,
                    grades: true
                },
                search: true,
                watch: true
            }
        });
        this.setupRequestHandlers();
        this.startWatchPolling();
    }
    setupRequestHandlers() {
        // List available resources
        this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
            const courses = await this.canvasAPI.listCourses(['term', 'total_students']);
            return {
                resources: courses.map(course => ({
                    uri: `canvas:///courses/${course.id}`,
                    name: course.name,
                    metadata: {
                        code: course.course_code,
                        term: course.term?.name,
                        startDate: course.start_at,
                        endDate: course.end_at,
                        students: course.total_students
                    }
                }))
            };
        });
        // Read specific resource
        this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
            const uri = request.params.uri;
            const resourceType = this.parseResourceType(uri);
            const content = await this.fetchResourceContent(resourceType, uri);
            return {
                contents: [{
                        uri,
                        mimeType: 'application/json',
                        text: JSON.stringify(content, null, 2)
                    }]
            };
        });
        // Search resources
        this.server.setRequestHandler(SearchResourcesRequestSchema, async (request) => {
            const query = request.params.query.toLowerCase();
            const courses = await this.canvasAPI.listCourses(['term']);
            const matchingCourses = courses.filter(course => course.name.toLowerCase().includes(query) ||
                course.course_code.toLowerCase().includes(query));
            return {
                resources: matchingCourses.map(course => ({
                    uri: `canvas:///courses/${course.id}`,
                    name: course.name,
                    metadata: {
                        code: course.course_code,
                        term: course.term?.name
                    }
                }))
            };
        });
        // Watch resources for changes
        this.server.setRequestHandler(WatchResourcesRequestSchema, async (request) => {
            const { resources } = request.params;
            for (const resource of resources) {
                if (!this.watchedResources.has(resource)) {
                    this.watchedResources.set(resource, {
                        lastCheck: new Date(),
                        lastContent: await this.fetchResourceContent(this.parseResourceType(resource), resource)
                    });
                }
            }
            return { success: true };
        });
    }
    parseResourceType(uri) {
        const parts = uri.split('/');
        return {
            type: parts[3], // courses, modules, assignments, etc.
            courseId: parts[4],
            subType: parts[5], // modules, assignments, submissions
            subId: parts[6]
        };
    }
    async fetchResourceContent(resourceType, uri) {
        const { type, courseId, subType, subId } = resourceType;
        switch (type) {
            case 'courses': {
                const [course, modules, assignments] = await Promise.all([
                    this.canvasAPI.getCourse(courseId, ['term', 'teachers', 'total_students']),
                    this.canvasAPI.listModules(courseId),
                    this.canvasAPI.listAssignments(courseId, ['submission'])
                ]);
                return {
                    course,
                    modules,
                    assignments
                };
            }
            case 'modules': {
                if (subId) {
                    return await this.canvasAPI.getModuleItems(courseId, subId);
                }
                return await this.canvasAPI.listModules(courseId);
            }
            case 'assignments': {
                if (subId) {
                    if (subType === 'submissions') {
                        return await this.canvasAPI.listSubmissions(courseId, subId, ['submission_comments']);
                    }
                    return await this.canvasAPI.getAssignment(courseId, subId, ['submission']);
                }
                return await this.canvasAPI.listAssignments(courseId, ['submission']);
            }
            default:
                throw new Error(`Unsupported resource type: ${type}`);
        }
    }
    async startWatchPolling() {
        setInterval(async () => {
            for (const [uri, data] of this.watchedResources.entries()) {
                try {
                    const newContent = await this.fetchResourceContent(this.parseResourceType(uri), uri);
                    if (JSON.stringify(newContent) !== JSON.stringify(data.lastContent)) {
                        const message = new ResourceUpdateMessage({
                            uri,
                            contents: [{
                                    uri,
                                    mimeType: 'application/json',
                                    text: JSON.stringify(newContent, null, 2)
                                }]
                        });
                        await this.server.broadcast(message);
                        this.watchedResources.set(uri, {
                            lastCheck: new Date(),
                            lastContent: newContent
                        });
                    }
                }
                catch (error) {
                    console.error(`Error polling resource ${uri}:`, error);
                }
            }
        }, this.pollInterval);
    }
    async start() {
        const transport = new StdioServerTransport();
        await this.server.connect(transport);
        console.log('Canvas MCP Server started');
    }
}
// Start the server
const canvasURL = process.env.CANVAS_API_URL;
const accessToken = process.env.CANVAS_ACCESS_TOKEN;
if (!canvasURL || !accessToken) {
    console.error('Error: CANVAS_API_URL and CANVAS_ACCESS_TOKEN environment variables are required');
    process.exit(1);
}
const server = new CanvasMCPServer(canvasURL, accessToken);
await server.start();
