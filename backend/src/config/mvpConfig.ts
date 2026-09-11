/**
 * Global MVP Configuration Settings
 */
export const IS_MVP_MODE = process.env.MVP_MODE === 'true';
export const MAX_ROOM_CAPACITY = parseInt(process.env.MAX_ROOM_CAPACITY || '45', 10);
export const MAX_HOST_ACCOUNTS = parseInt(process.env.MAX_HOST_ACCOUNTS || '3', 10);
