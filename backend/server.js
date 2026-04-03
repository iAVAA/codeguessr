import express from "express";

const app = express();
const PORT = 3000;

app.get("/hello", (req, res) => {
  console.log("Client said hello");
  res.sendStatus(200);
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});