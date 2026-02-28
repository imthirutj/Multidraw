import prisma from '../lib/prisma';
import type { PublicBookmark } from '../types/game.types';

export const BookmarkRepository = {
    async getAll(): Promise<PublicBookmark[]> {
        const bookmarks = await prisma.publicBookmark.findMany({
            orderBy: { createdAt: 'desc' },
        });
        return bookmarks.map(b => ({
            id: b.id,
            url: b.url,
            title: b.title || undefined,
            thumbnailUrl: b.thumbnailUrl || undefined,
            savedBy: b.savedBy,
            savedAt: b.createdAt.getTime(),
        }));
    },

    async add(data: Omit<PublicBookmark, 'id' | 'savedAt'>): Promise<PublicBookmark[]> {
        await prisma.publicBookmark.upsert({
            where: { url: data.url },
            update: {
                title: data.title,
                thumbnailUrl: data.thumbnailUrl,
            },
            create: {
                url: data.url,
                title: data.title,
                thumbnailUrl: data.thumbnailUrl,
                savedBy: data.savedBy,
            },
        });
        return this.getAll();
    },

    async remove(url: string): Promise<PublicBookmark[]> {
        await prisma.publicBookmark.deleteMany({
            where: { url },
        });
        return this.getAll();
    }
};
