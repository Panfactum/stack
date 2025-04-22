import { z } from "zod";

export const AWS_SECRET_KEY_SCHEMA =z.string().regex(
    /^[A-Za-z0-9/+=]{40}$/,
    "Invalid AWS Secret Access Key. AWS Secret Access Keys are 40 characters long and contain only alphanumeric characters, forward slashes, plus signs and equals signs."
);

export const AWS_ACCESS_KEY_ID_SCHEMA = z.string().regex(
    /^AKIA[A-Z0-9]{16}$/,
    "Invalid AWS Access Key ID. AWS Access Key IDs are 20 characters and start with 'AKIA'"
)