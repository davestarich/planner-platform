// Vercel serverless entry point. Vercel runs this on demand for each request rather
// than as a long-running server, so we export the Express app as the handler instead
// of calling app.listen(). An Express app is itself a (req, res) handler.

import app from '../src/app.js'

export default app
