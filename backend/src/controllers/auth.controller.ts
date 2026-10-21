
import type { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma";

const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET;

  if (!secret) {
    throw new Error("JWT_SECRET is not configured.");
  }

  return secret;
};

export const cookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
};

export async function login(req: Request, res: Response) {
  try {
    const email =
      typeof req.body.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";

    const password =
      typeof req.body.password === "string"
        ? req.body.password
        : "";

    if (!email || !password) {
      return res.status(400).json({
        status: "error",
        message: "Email and password are required.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({
        status: "error",
        message: "Invalid email or password.",
      });
    }

    if (!user.isActive || user.role !== "ADMIN") {
      return res.status(403).json({
        status: "error",
        message: "This account is not authorized to access the system.",
      });
    }

    const token = jwt.sign(
      { role: user.role },
      getJwtSecret(),
      {
        subject: user.id,
        expiresIn: "8h",
      }
    );

    res.cookie("ba_token", token, {
      ...cookieOptions,
      maxAge: 8 * 60 * 60 * 1000,
    });

    return res.status(200).json({
      status: "success",
      message: "Login successful.",
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Login error:", error);

    return res.status(500).json({
      status: "error",
      message: "An unexpected error occurred.",
    });
  }
}

export function logout(_req: Request, res: Response) {
  res.clearCookie("ba_token", cookieOptions);

  return res.status(200).json({
    status: "success",
    message: "Logout successful.",
  });
}

export function me(_req: Request, res: Response) {
  return res.status(200).json({
    status: "success",
    user: res.locals.user,
  });
}
