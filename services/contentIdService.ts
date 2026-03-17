
let counter = 0;
const PREFIX = 'KBITAI';

export const ContentIdService = {
  generateId(): string {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0].replace(/-/g, '');
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    counter++;
    return `${PREFIX}-${dateStr}-${random}`;
  },

  generateBatchId(count: number = 1): string[] {
    return Array.from({ length: count }, () => this.generateId());
  },

  getCounter(): number {
    return counter;
  },

  resetCounter(): void {
    counter = 0;
  }
};

export default ContentIdService;
