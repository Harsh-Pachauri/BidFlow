import { Router } from "express";
import { z } from "zod";
import { login, InvalidCredentialsError } from "../services/auth.service";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post("/login", async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: "Invalid request body", details: parsed.error.flatten() });
    return;
  }

  try {
    const result = await login(parsed.data.email, parsed.data.password);
    res.json(result);
  } catch (err) {
    if (err instanceof InvalidCredentialsError) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }
    throw err;
  }
});

export default router;
