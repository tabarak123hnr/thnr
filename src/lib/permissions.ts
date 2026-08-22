import { navigation } from "../config/navigation";
import type { PermissionId } from "../config/permissions";

export function firstAllowedPath(
  hasPermission: (permission: string) => boolean,
): string {
  for (const section of navigation) {
    for (const item of section.items) {
      if (hasPermission(item.permission)) return item.path;
    }
  }
  return "";
}

export function canAccessPath(
  pathname: string,
  hasPermission: (permission: string) => boolean,
  pathPermission: Record<string, string>,
): boolean {
  const required = pathPermission[pathname];
  if (!required) return true;
  return hasPermission(required);
}

export function makePermissionChecker(
  permissions: PermissionId[],
  isAdmin: boolean,
) {
  return (permission: string) => {
    if (isAdmin) return true;
    return permissions.includes(permission as PermissionId);
  };
}
