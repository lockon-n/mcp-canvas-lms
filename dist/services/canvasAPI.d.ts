import type { CanvasConfig, CanvasCourse, CanvasModule, CanvasAssignment, CanvasSubmission } from '../types/canvas.js';
export declare class CanvasAPI {
    private api;
    constructor(config: CanvasConfig);
    listCourses(include?: string[]): Promise<CanvasCourse[]>;
    getCourse(courseId: string | number, include?: string[]): Promise<CanvasCourse>;
    listModules(courseId: string | number): Promise<CanvasModule[]>;
    listAssignments(courseId: string | number, include?: string[]): Promise<CanvasAssignment[]>;
    listSubmissions(courseId: string | number, assignmentId: string | number, include?: string[]): Promise<CanvasSubmission[]>;
    private handleError;
}
