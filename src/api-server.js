// Local starter for the API. Run with `npm run api`. It imports the app and starts a
// normal long-running server on your machine. (On Vercel, api/index.js is used instead.)

import app from './app.js'

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`planner-platform API listening on http://localhost:${PORT}`)
})
