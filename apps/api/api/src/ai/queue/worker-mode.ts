// Evaluated before AppModule so worker instances do not run database migrations.
process.env.AI_WORKER_PROCESS = 'true';
