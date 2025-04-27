import { z } from "zod";
import { AWS_PHONE_NUMBER_SCHEMA, COUNTRY_CODES } from "@/util/aws/schemas";
import type { PanfactumContext } from "@/context/context";
import type { PanfactumTaskWrapper } from "@/util/listr/types";

export async function getPrimaryContactInfo(inputs: { context: PanfactumContext, parentTask: PanfactumTaskWrapper }) {

    const { context, parentTask } = inputs;

    const fullName = await context.logger.input({
        task: parentTask,
        message: 'Full Name:',
        required: true,
        validate: (value) => {
            if (value === "") {
                return true
            } else if (value.length < 2) {
                return "Must be at least 2 characters"
            } else if (value.length > 128) {
                return "Cannot be greater than 128 characters"
            } else if (!value.includes(" ")) {
                return "Should include a first and last name (full name)"
            } else {
                return true
            }
        }
    });
    const orgName = await context.logger.input({
        task: parentTask,
        message: 'Organization / Company Name (Optional):',
        validate: (value) => {
            if (value === "") {
                return true
            } else if (value.length < 3) {
                return "Must be at least 3 characters"
            } else if (value.length > 128) {
                return "Cannot be greater than 128 characters"
            } else {
                return true
            }
        }
    });
    const email = await context.logger.input({
        task: parentTask,
        message: 'Email:',
        required: true,
        validate: (value) => {
            const { error } = z.string().email().safeParse(value)
            if (error) {
                return error.issues[0]?.message ?? "Invalid email"
            } else {
                return true
            }
        }
    });
    const phoneNumber = await context.logger.input({
        task: parentTask,
        message: 'Phone #:',
        required: true,
        validate: (value) => {
            const { error } = AWS_PHONE_NUMBER_SCHEMA.safeParse(value)
            if (error) {
                return error.issues[0]?.message ?? "Invalid phone number"
            } else {
                return true
            }
        }
    });
    const address1 = await context.logger.input({
        task: parentTask,
        message: 'Street Address 1:',
        required: true,
        validate: (value) => {
            if (value.length < 5) {
                return "Must be at least 5 characters"
            } else if (value.length > 128) {
                return "Cannot be greater than 128 characters"
            } else {
                return true
            }
        }
    });
    const address2 = await context.logger.input({
        task: parentTask,
        message: 'Street Address 2 (Optional):',
        validate: (value) => {
            if (value === "") {
                return true
            } else if (value.length < 5) {
                return "Must be at least 5 characters"
            } else if (value.length > 128) {
                return "Cannot be greater than 128 characters"
            } else {
                return true
            }
        }
    });
    const city = await context.logger.input({
        task: parentTask,
        message: 'City:',
        required: true,
        validate: (value) => {
            if (value === "") {
                return true
            } else if (value.length < 2) {
                return "Must be at least 2 characters"
            } else if (value.length > 128) {
                return "Cannot be greater than 128 characters"
            } else {
                return true
            }
        }
    });
    const state = await context.logger.input({
        task: parentTask,
        message: 'State/Region:',
        required: true,
        validate: (value) => {
            if (value === "") {
                return true
            } else if (value.length < 2) {
                return "Must be at least 2 characters"
            } else if (value.length > 128) {
                return "Cannot be greater than 128 characters"
            } else {
                return true
            }
        }
    });
    const postalCode = await context.logger.input({
        task: parentTask,
        message: 'Postal Code:',
        required: true,
        validate: (value) => {
            if (!/^[0-9A-Z -]+$/.test(value)) {
                return "Can only contain numbers, uppercase letters, hyphens, and spaces"
            } else if ((value.match(/[0-9A-Z]/g) || []).length < 2) {
                return "Must contain at least 2 numbers or letters"
            } else if (/^[ -]|[ -]$/.test(value)) {
                return "Cannot start or end with a space or hyphen"
            } else {
                return true
            }
        }
    });
    const countryCode = await context.logger.search({
        task: parentTask,
        message: 'Country:',
        source: (term) => {
            return term ? COUNTRY_CODES.filter(({ name }) => name.toLowerCase().includes(term.toLowerCase())) : COUNTRY_CODES
        }
    });

    return {
        countryCode,
        postalCode,
        state,
        city,
        address1,
        address2: address2 === "" ? undefined : address2,
        email,
        orgName: orgName === "" ? undefined : orgName,
        fullName,
        phoneNumber
    }
}