/** Google Drive STUB — preview/offline mode */
export interface DriveBackupFile { id: string; name: string; modifiedTime: string; }
export interface BackupPayload { project: any; chapters: any[]; characters: any[]; plotNodes: any[]; research: any[]; sourceMaterials: any[]; externalReviews: any[]; backupDate: string; }

export async function listDriveBackups(): Promise<DriveBackupFile[]> { return []; }
export async function uploadDriveBackup(_t: string, _id: string, _p: BackupPayload): Promise<any> {}
export async function downloadDriveBackup(_fileId: string): Promise<any> { throw new Error('Drive not available in local mode'); }
