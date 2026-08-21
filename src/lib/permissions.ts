import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, adminAc, ownerAc, memberAc } from "better-auth/plugins/organization/access";

// 1. Merge default org statements with your custom ones
export const statement = {
    ...defaultStatements,           // ← THIS IS THE FIX: adds organization, member, invitation
    document: ["upload", "sign", "delete", "view"],
    template: ["create", "manage"],
} as const;

export const ac = createAccessControl(statement);

// 2. Create roles that include BOTH default permissions AND your custom ones
export const orgOwner = ac.newRole({
    ...ownerAc.statements,          
    document: ["upload", "sign", "delete", "view"],
    template: ["create", "manage"],
});

export const orgAdmin = ac.newRole({
    ...adminAc.statements,         
    document: ["upload", "sign", "delete", "view"],
    template: ["create", "manage"],
});

export const orgMember = ac.newRole({
    ...memberAc.statements,         
    document: ["upload", "sign", "view"],
    template: ["create"],
});
