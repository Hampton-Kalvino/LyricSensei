import bcrypt from "bcryptjs";
import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import GoogleStrategy from "passport-google-oauth20";
import AppleStrategy from "passport-apple";
import FacebookStrategy from "passport-facebook";
import TwitterStrategy from "passport-twitter";
import session from "express-session";
import connectPg from "connect-pg-simple";
import type { Express, Request, Response, NextFunction } from "express";
import { storage } from "./storage";
import { randomBytes } from "crypto";

function generateId(): string {
  return randomBytes(16).toString("hex");
}

function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: false,
    ttl: sessionTtl,
    tableName: "sessions",
  });
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: true,
      maxAge: sessionTtl,
    },
  });
}

export async function setupNewAuth(app: Express) {
  // Setup session middleware first (required for passport)
  app.set("trust proxy", 1);
  app.use(getSession());
  
  // Initialize passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Serialize user
  passport.serializeUser((user: any, done: any) => {
    done(null, user.id);
  });

  // Deserialize user
  passport.deserializeUser(async (id: string, done: any) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(null, null); // User not found, but this is not an error
      }
      done(null, user);
    } catch (error) {
      // Silently fail for unauthenticated requests instead of throwing
      done(null, null);
    }
  });

  // Local strategy for password auth
  passport.use(
    "local",
    new LocalStrategy(
      {
        usernameField: "email",
        passwordField: "password",
      },
      async (email: string, password: string, done: any) => {
        try {
          const user = await storage.getUserByEmail(email);
          if (!user) {
            return done(null, false, { message: "Invalid email or password" });
          }

          if (!user.passwordHash) {
            return done(null, false, { message: "Invalid email or password" });
          }

          const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
          if (!isPasswordValid) {
            return done(null, false, { message: "Invalid email or password" });
          }

          return done(null, user);
        } catch (error) {
          return done(error);
        }
      }
    )
  );

  // Google strategy
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    passport.use(
      "google",
      new (GoogleStrategy as any)(
        {
          clientID: process.env.GOOGLE_CLIENT_ID,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          callbackURL: `${process.env.BACKEND_URL || "https://lyricsensei.com"}/api/auth/google/callback`,
        },
        async (accessToken: any, refreshToken: any, profile: any, done: any) => {
          try {
            let user = await storage.getUserByEmail(profile.emails?.[0]?.value || "");

            if (!user) {
              // Create new user from Google profile
              user = await storage.createUser({
                id: generateId(),
                email: profile.emails?.[0]?.value,
                firstName: profile.name?.givenName,
                lastName: profile.name?.familyName,
                profileImageUrl: profile.photos?.[0]?.value,
                authProvider: "google",
                isGuest: false,
              });
            } else {
              // Update auth provider if user exists
              if (user.authProvider !== "google") {
                await storage.updateUserAuthProvider(user.id, "google");
              }
              // Update profile image if Google provides one
              if (profile.photos?.[0]?.value && user.profileImageUrl !== profile.photos?.[0]?.value) {
                user = await storage.updateUserProfile(user.id, {
                  profileImageUrl: profile.photos?.[0]?.value,
                });
              }
              // Update name if not set
              if (!user.firstName && profile.name?.givenName) {
                user = await storage.updateUserProfile(user.id, {
                  firstName: profile.name?.givenName,
                  lastName: profile.name?.familyName,
                });
              }
            }

            return done(null, user);
          } catch (error) {
            return done(error);
          }
        }
      )
    );
  }

  // Apple strategy
  if (process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY) {
    passport.use(
      "apple",
      new (AppleStrategy as any)(
        {
          clientID: process.env.APPLE_CLIENT_ID,
          teamID: process.env.APPLE_TEAM_ID,
          keyID: process.env.APPLE_KEY_ID,
          privateKeyString: process.env.APPLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
          callbackURL: `${process.env.BACKEND_URL || "https://lyricsensei.com"}/api/auth/apple/callback`,
        },
        async (accessToken: any, refreshToken: any, idToken: any, profile: any, done: any) => {
          try {
            // Apple sends email only on first login, use user_id as fallback
            const email = profile.email || `${profile.id}@appleid.apple.com`;
            let user = await storage.getUserByEmail(email);

            if (!user) {
              user = await storage.createUser({
                id: generateId(),
                email,
                firstName: profile.displayName?.split(" ")[0] || "Apple",
                lastName: profile.displayName?.split(" ").slice(1).join(" "),
                profileImageUrl: profile.photos?.[0]?.value,
                authProvider: "apple",
                isGuest: false,
              });
            } else {
              // Update auth provider if user exists
              if (user.authProvider !== "apple") {
                await storage.updateUserAuthProvider(user.id, "apple");
              }
              // Update profile image if Apple provides one
              if (profile.photos?.[0]?.value && user.profileImageUrl !== profile.photos?.[0]?.value) {
                user = await storage.updateUserProfile(user.id, {
                  profileImageUrl: profile.photos?.[0]?.value,
                });
              }
              // Update name if not set
              if (!user.firstName && profile.displayName) {
                user = await storage.updateUserProfile(user.id, {
                  firstName: profile.displayName?.split(" ")[0] || "Apple",
                  lastName: profile.displayName?.split(" ").slice(1).join(" "),
                });
              }
            }

            return done(null, user);
          } catch (error) {
            return done(error);
          }
        }
      )
    );
  }

  // Facebook strategy
  if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
    passport.use(
      "facebook",
      new (FacebookStrategy as any)(
        {
          clientID: process.env.FACEBOOK_APP_ID,
          clientSecret: process.env.FACEBOOK_APP_SECRET,
          callbackURL: `${process.env.BACKEND_URL || "https://lyricsensei.com"}/api/auth/facebook/callback`,
          profileFields: ["id", "displayName", "photos", "email", "name"],
        },
        async (accessToken: any, refreshToken: any, profile: any, done: any) => {
          try {
            let user = await storage.getUserByEmail(profile.emails?.[0]?.value || "");

            if (!user) {
              user = await storage.createUser({
                id: generateId(),
                email: profile.emails?.[0]?.value,
                firstName: profile.name?.givenName,
                lastName: profile.name?.familyName,
                profileImageUrl: profile.photos?.[0]?.value,
                authProvider: "facebook",
                isGuest: false,
              });
            } else {
              // Update auth provider if user exists
              if (user.authProvider !== "facebook") {
                await storage.updateUserAuthProvider(user.id, "facebook");
              }
              // Update profile image if Facebook provides one
              if (profile.photos?.[0]?.value && user.profileImageUrl !== profile.photos?.[0]?.value) {
                user = await storage.updateUserProfile(user.id, {
                  profileImageUrl: profile.photos?.[0]?.value,
                });
              }
              // Update name if not set
              if (!user.firstName && profile.name?.givenName) {
                user = await storage.updateUserProfile(user.id, {
                  firstName: profile.name?.givenName,
                  lastName: profile.name?.familyName,
                });
              }
            }

            return done(null, user);
          } catch (error) {
            return done(error);
          }
        }
      )
    );
  }

  // Twitter strategy
  if (process.env.TWITTER_CONSUMER_KEY && process.env.TWITTER_CONSUMER_SECRET) {
    passport.use(
      "twitter",
      new (TwitterStrategy as any)(
        {
          consumerKey: process.env.TWITTER_CONSUMER_KEY,
          consumerSecret: process.env.TWITTER_CONSUMER_SECRET,
          callbackURL: `${process.env.BACKEND_URL || "https://lyricsensei.com"}/api/auth/twitter/callback`,
          includeEmail: true,
          userProfileURL: "https://api.twitter.com/1.1/account/verify_credentials.json?include_email=true",
        },
        async (token: any, tokenSecret: any, profile: any, done: any) => {
          try {
            let user = await storage.getUserByEmail(profile.emails?.[0]?.value || "");

            if (!user) {
              user = await storage.createUser({
                id: generateId(),
                email: profile.emails?.[0]?.value,
                firstName: profile.displayName?.split(" ")[0],
                lastName: profile.displayName?.split(" ").slice(1).join(" "),
                profileImageUrl: profile.photos?.[0]?.value,
                authProvider: "twitter",
                isGuest: false,
              });
            } else {
              // Update auth provider if user exists
              if (user.authProvider !== "twitter") {
                await storage.updateUserAuthProvider(user.id, "twitter");
              }
              // Update profile image if Twitter provides one
              if (profile.photos?.[0]?.value && user.profileImageUrl !== profile.photos?.[0]?.value) {
                user = await storage.updateUserProfile(user.id, {
                  profileImageUrl: profile.photos?.[0]?.value,
                });
              }
              // Update name if not set
              if (!user.firstName && profile.displayName) {
                user = await storage.updateUserProfile(user.id, {
                  firstName: profile.displayName?.split(" ")[0],
                  lastName: profile.displayName?.split(" ").slice(1).join(" "),
                });
              }
            }

            return done(null, user);
          } catch (error) {
            return done(error);
          }
        }
      )
    );
  }

  // Login routes
  app.post("/api/auth/login", (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        return res.status(500).json({ error: "Authentication error" });
      }
      if (!user) {
        return res.status(401).json({ error: info?.message || "Invalid credentials" });
      }

      req.logIn(user, (err: any) => {
        if (err) {
          return res.status(500).json({ error: "Login failed" });
        }
        res.json({ user });
      });
    })(req, res, next);
  });

  // Sign up
  app.post("/api/auth/signup", async (req: Request, res: Response) => {
    try {
      const { email, password, username, firstName, lastName } = req.body;

      if (!email || !password || !username) {
        return res.status(400).json({ error: "Email, password, and username are required" });
      }

      // Check if user exists
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(409).json({ error: "Email already registered" });
      }

      // Check if username is taken
      const existingUsername = await storage.getUserByUsername(username);
      if (existingUsername) {
        return res.status(409).json({ error: "Username already taken" });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, 10);

      // Create user
      const user = await storage.createUser({
        id: generateId(),
        email,
        username,
        firstName,
        lastName,
        passwordHash,
        authProvider: "password",
        isGuest: false,
      });

      req.logIn(user, (err: any) => {
        if (err) {
          return res.status(500).json({ error: "Login failed" });
        }
        res.json({ user });
      });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ error: "Signup failed" });
    }
  });

  // Guest mode - simplified for mobile compatibility
  app.post("/api/auth/guest", async (req: Request, res: Response) => {
    try {
      // Generate a simple guest ID without creating a database user
      const guestId = `guest-${randomBytes(16).toString("hex")}`;
      
      // Return the guest user object (matches what frontend expects)
      const guestUser = {
        id: guestId,
        email: null,
        username: 'Guest',
        isGuest: true,
        isPremium: false,
        authProvider: 'guest',
        createdAt: new Date().toISOString(),
      };

      // Don't create session - mobile apps will use header-based auth
      res.json({ user: guestUser });
    } catch (error) {
      console.error("Guest login error:", error);
      res.status(500).json({ error: "Guest login failed" });
    }
  });

  // OAuth helper - check if strategy exists
  const authWithFallback = (strategyName: string, options: any = {}) => {
    return (req: Request, res: Response, next: NextFunction) => {
      try {
        const strategy = passport._strategies?.[strategyName];
        if (!strategy) {
          return res.status(400).json({ error: `${strategyName} authentication is not configured` });
        }
        passport.authenticate(strategyName, options)(req, res, next);
      } catch (error) {
        res.status(400).json({ error: `${strategyName} authentication failed` });
      }
    };
  };

  // Google OAuth
  if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
    app.get(
      "/api/auth/google",
      passport.authenticate("google", { scope: ["profile", "email"] })
    );

    app.get(
      "/api/auth/google/callback",
      passport.authenticate("google", { failureRedirect: "/auth/login" }),
      (req, res) => {
        res.redirect("/");
      }
    );
  }

  // Apple OAuth
  if (process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY) {
    app.get(
      "/api/auth/apple",
      passport.authenticate("apple", { scope: ["name", "email"] })
    );

    app.post(
      "/api/auth/apple/callback",
      passport.authenticate("apple", { failureRedirect: "/auth/login" }),
      (req, res) => {
        res.redirect("/");
      }
    );
  }

  // Facebook OAuth
  if (process.env.FACEBOOK_APP_ID && process.env.FACEBOOK_APP_SECRET) {
    app.get(
      "/api/auth/facebook",
      passport.authenticate("facebook", { scope: ["email"] })
    );

    app.get(
      "/api/auth/facebook/callback",
      passport.authenticate("facebook", { failureRedirect: "/auth/login" }),
      (req, res) => {
        res.redirect("/");
      }
    );
  }

  // Twitter OAuth
  if (process.env.TWITTER_CONSUMER_KEY && process.env.TWITTER_CONSUMER_SECRET) {
    app.get(
      "/api/auth/twitter",
      passport.authenticate("twitter")
    );

    app.get(
      "/api/auth/twitter/callback",
      passport.authenticate("twitter", { failureRedirect: "/auth/login" }),
      (req, res) => {
        res.redirect("/");
      }
    );
  }

  // Logout
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.logOut((err: any) => {
      if (err) {
        return res.status(500).json({ error: "Logout failed" });
      }
      res.json({ success: true });
    });
  });

  // Note: /api/auth/user endpoint is defined in routes.ts to handle both authenticated and guest users
}

// Middleware to check authentication (supports session-based, header-based guest auth, and header-based user auth for mobile)
export const isAuthenticated = async (req: Request, res: Response, next: NextFunction) => {
  // Check for guest ID in headers (for mobile/header-based auth)
  const guestId = (req.headers as any)['x-guest-id'];
  if (guestId && typeof guestId === 'string' && guestId.startsWith('guest-')) {
    // Create a temporary guest user object on req for this request
    (req as any).user = {
      id: guestId,
      email: null,
      username: 'Guest',
      isGuest: true,
      isPremium: false,
      authProvider: 'guest',
    };
    return next();
  }

  // Check for authenticated user ID in headers (for mobile Capacitor fallback when session fails)
  const userId = (req.headers as any)['x-user-id'];
  if (userId && typeof userId === 'string') {
    try {
      const user = await storage.getUser(userId);
      if (user) {
        (req as any).user = user;
        return next();
      }
    } catch (error) {
      console.error('[Auth] Error fetching user from header:', error);
    }
  }

  // Check for session-based authentication (Passport)
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: "Authentication required" });
  }
  next();
};

// Helper function to extract user ID (works for both OAuth and local users)
export function getUserId(user: any): string {
  return user.id || user.claims?.sub;
}

// Helper function to hash password
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

// Helper function to verify password
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
