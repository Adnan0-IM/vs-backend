import { createAccessControl } from "better-auth/plugins/access";

export const statement = {
	document: ["upload", "sign", "delete", "view"],
	template: ["create", "manage"],
} as const;

export const ac = createAccessControl(statement);

export const orgOwner = ac.newRole({
	document: ["upload", "sign", "delete", "view"],
	template: ["create", "manage"],
});

export const orgAdmin = ac.newRole({
	document: ["upload", "sign", "delete", "view"],
	template: ["create", "manage"],
});

export const signer = ac.newRole({
	document: ["upload", "sign", "view"],
});

export const viewer = ac.newRole({
	document: ["view"],
});