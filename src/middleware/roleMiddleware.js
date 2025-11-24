import { logError } from "./logger.js";

export function authorizeRoles(...allowedRoles) {
    return (req, res, next) => {
      try {
        const user = req.user;
  
        if (!user || !user.role) {
          return res.status(401).json({ 
            message: "Unauthorized: No role found",
            required: allowedRoles 
          });
        }
  
        if (!allowedRoles.includes(user.role)) {
          logError(
            new Error(`Access denied: User role '${user.role}' not in allowed roles [${allowedRoles.join(', ')}]`),
            `RBAC Authorization Failed - ${req.method} ${req.url}`
          );
          return res.status(403).json({ 
            message: "Forbidden: Access denied",
            userRole: user.role,
            required: allowedRoles 
          });
        }
  
        next();
      } catch (error) {
        logError(error, `RBAC Error - ${req.method} ${req.url}`);
        res.status(500).json({ message: "Server error in RBAC" });
      }
    };
}