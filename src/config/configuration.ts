export default () => ({
  port: parseInt(process.env.PORT || '4000', 10),
  mongodb: {
    uri: process.env.MONGODB_URI,
    testUri: process.env.MONGODB_URI_TEST,
  },
  nodeEnv: process.env.NODE_ENV || 'development',
  cors: {
    origins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:3000'],
  },
  swagger: {
    enabled:
      process.env.SWAGGER === 'on' ||
      (process.env.NODE_ENV !== 'production' && process.env.SWAGGER !== 'off'),
  },
  devWorkspaceId: process.env.DEV_WORKSPACE_ID || 'ws_maison_ambre',
  ai: {
    geminiApiKey: process.env.GEMINI_API_KEY,
    geminiModel: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
  },
});
