import express from "express";
import dotenv from "dotenv";
import { createClient } from "@supabase/supabase-js";

// Carica le variabili d'ambiente
dotenv.config();

const app = express();
app.use(express.json());

// Connetti Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_PUBLISHABLE_DEFAULT_KEY);

// Endpoint di test
app.get("/users", async (req, res) => {
  try {
    const { data, error } = await supabase.from("users").select("*");
    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});