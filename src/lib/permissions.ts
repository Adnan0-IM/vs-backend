import { createAccessControl } from "better-auth/plugins/access";
import { defaultStatements, adminAc, ownerAc, memberAc } from "better-auth/plugins/organization/access";

export const statement = {
    ...defaultStatements,          
    document: ["upload", "sign", "delete", "view"],
    template: ["create", "manage"],
} as const;

export const ac = createAccessControl(statement);

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
