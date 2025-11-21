export function authorizeRoles(...allowedRoles) {
    return (req, res, next) => {
      try {
        const user = req.user;
  
        if (!user || !user.role) {
          return res.status(401).json({ message: "Unauthorized: No role found" });
        }
  
        if (!allowedRoles.includes(user.role)) {
          return res.status(403).json({ message: "Forbidden: Access denied" });
        }
  
        next();
      } catch (error) {
        res.status(500).json({ message: "Server error in RBAC" });
      }
    };

}