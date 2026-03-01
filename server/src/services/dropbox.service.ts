import { Dropbox } from 'dropbox';
import env from '../config/env';

export class DropboxService {
    private static dbx = new Dropbox({ accessToken: env.DROPBOX_TOKEN });

    /**
     * Uploads a file (base64 string) to Dropbox.
     * Returns the filename (path) in Dropbox.
     */
    static async uploadFile(base64Data: string, filename: string): Promise<string> {
        if (!env.DROPBOX_TOKEN) {
            console.error('❌ Dropbox token is missing!');
            return '';
        }

        try {
            // Support both data URLs and raw base64
            const base64Content = base64Data.includes(',') ? base64Data.split(',')[1] : base64Data;
            const buffer = Buffer.from(base64Content, 'base64');

            const uploadRes = await this.dbx.filesUpload({
                path: `/${filename}`,
                contents: buffer,
                mode: { '.tag': 'add' }
            });

            console.log('✅ File uploaded to Dropbox:', uploadRes.result.path_display);
            return filename; // Store only filename in DB
        } catch (error: any) {
            console.error('❌ Dropbox upload error:', error);
            throw error;
        }
    }

    /**
     * Downloads a file from Dropbox and returns the binary data.
     */
    static async downloadVoiceNote(filename: string): Promise<any> {
        const response = await this.dbx.filesDownload({ path: `/${filename}` });
        return (response.result as any).fileBinary;
    }
}
