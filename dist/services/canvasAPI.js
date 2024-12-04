import axios from 'axios';
export class CanvasAPI {
    api;
    constructor(config) {
        this.api = axios.create({
            baseURL: config.baseURL,
            headers: {
                Authorization: `Bearer ${config.accessToken}`,
                'Content-Type': 'application/json'
            }
        });
    }
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
    async listModules(courseId) {
        try {
            const response = await this.api.get(`/api/v1/courses/${courseId}/modules`);
            return response.data;
        }
        catch (error) {
            throw this.handleError(`Failed to list modules for course ${courseId}`, error);
        }
    }
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
    async listSubmissions(courseId, assignmentId, include = []) {
        try {
            const response = await this.api.get(`/api/v1/courses/${courseId}/assignments/${assignmentId}/submissions`, { params: { include: include.join(',') } });
            return response.data;
        }
        catch (error) {
            throw this.handleError(`Failed to list submissions for assignment ${assignmentId}`, error);
        }
    }
    handleError(message, error) {
        console.error(`Canvas API Error: ${message}`, error.response?.data || error);
        const errorData = error.response?.data;
        return new Error(`${message}: ${errorData?.errors?.[0]?.message || error.message}`);
    }
}
