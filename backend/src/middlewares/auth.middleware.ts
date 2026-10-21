
import type { Request, Response, NextFunction } from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";
import { prisma } from "../lib/prisma";

export async function requireAuth(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  try {
    const token = _req.cookies?.ba_token;

    if (!token) {
      return res.status(401).json({
        status: "error",
        message: "Authentication required.",
      });
    }

    const secret = process.env.JWT_SECRET;

    if (!secret) {
      throw new Error("JWT_SECRET is not configured.");
    }

    const decoded = jwt.verify(token, secret);

    if (
      typeof decoded === "string" ||
      !decoded.sub ||
      (decoded as JwtPayload).role !== "ADMIN"
    ) {
      return res.status(401).json({
        status: "error",
        message: "Invalid authentication token.",
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.sub },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
      },
    });

    if (!user || !user.isActive || user.role !== "ADMIN") {
      res.clearCookie("ba_token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });

      return res.status(401).json({
        status: "error",
        message: "Your session is no longer valid.",
      });
    }

    res.locals.user = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    if (
      error instanceof jwt.JsonWebTokenError ||
      error instanceof jwt.TokenExpiredError
    ) {
      res.clearCookie("ba_token", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      });

      return res.status(401).json({
        status: "error",
        message: "Session is invalid or expired. Please log in again.",
      });
    }

    console.error("Authentication error:", error);

    return res.status(500).json({
      status: "error",
      message: "An unexpected error occurred.",
    });
  }
}
