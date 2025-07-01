import { GetContactInformationCommand } from "@aws-sdk/client-account";
import { z } from "zod";
import { getAccountClient } from "@/util/aws/clients/getAccountClient";
import { AWS_PHONE_NUMBER_SCHEMA, COUNTRY_CODES } from "@/util/aws/schemas";
import type { PanfactumContext } from "@/util/context/context";
import type { PanfactumTaskWrapper } from "@/util/listr/types";

/**
 * Interface for getPrimaryContactInfo function inputs
 */
interface IGetPrimaryContactInfoInputs {
  /** Panfactum context for logging and configuration */
  context: PanfactumContext;
  /** Parent task for UI interaction */
  parentTask: PanfactumTaskWrapper;
  /** AWS profile for account access */
  profile: string;
}

/**
 * Interface for contact information return type
 */
interface IContactInfo {
  /** Country code for the contact */
  countryCode: string;
  /** Postal code */
  postalCode: string;
  /** State or region */
  state: string;
  /** City name */
  city: string;
  /** Primary address line */
  address1: string;
  /** Secondary address line (optional) */
  address2?: string;
  /** Email address */
  email: string;
  /** Organization name (optional) */
  orgName?: string;
  /** Full name of contact */
  fullName: string;
  /** Phone number */
  phoneNumber: string;
}

export async function getPrimaryContactInfo(inputs: IGetPrimaryContactInfoInputs): Promise<IContactInfo> {

    const { context, parentTask, profile } = inputs;

    const existingInfo = await getExistingContactInfo(profile, context)

    const fullName = await context.logger.input({
        task: parentTask,
        message: 'Full Name:',
        required: true,
        default: existingInfo.fullName,
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
        required: false,
        default: existingInfo.organizationName,
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
        default: existingInfo.email,
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
        message: 'Phone # (+1 555-555-5555):',
        default: existingInfo.phoneNumber,
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
        default: existingInfo.addressLine1,
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
        required: false,
        default: existingInfo.addressLine2,
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
    const city = await context.logger.input({
        task: parentTask,
        message: 'City:',
        default: existingInfo.city,
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
        default: existingInfo.state,
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
        default: existingInfo.zipCode,
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
        default: existingInfo.countryCode,
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

/**
 * Interface for existing contact information return type
 */
interface IExistingContactInfo {
  /** Full name (optional) */
  fullName?: string;
  /** Organization name (optional) */
  organizationName?: string;
  /** Email address (optional) */
  email?: string;
  /** Phone number (optional) */
  phoneNumber?: string;
  /** Primary address line (optional) */
  addressLine1?: string;
  /** Secondary address line (optional) */
  addressLine2?: string;
  /** City name (optional) */
  city?: string;
  /** State or region (optional) */
  state?: string;
  /** Country code (optional) */
  countryCode?: string;
  /** Postal code (optional) */
  zipCode?: string;
}

/**
 * Retrieves primary contact information from AWS account using the Account API so that 
 * we can use it as defaults for the account setup
 */
async function getExistingContactInfo(profile: string, context: PanfactumContext): Promise<IExistingContactInfo> {
    // Create an AccountClient
    const accountClient = await getAccountClient({ context, profile })

    // Create command to get contact information
    const getContactInfoCommand = new GetContactInformationCommand({});

    // Send the command to AWS
    const response = await accountClient.send(getContactInfoCommand).catch((error) => {
        // If we can't get the contact info, just log and continue
        context.logger.debug(
            `Could not retrieve primary contact information from AWS: ${error instanceof Error ? error.message : String(error)}`);
        return null;
    });

    if (response?.ContactInformation) {
        const contactInfo = response.ContactInformation;

        // Convert AWS contact format to our format
        return {
            fullName: contactInfo.FullName,
            organizationName: contactInfo.CompanyName,
            phoneNumber: contactInfo.PhoneNumber ? contactInfo.PhoneNumber.replace(/(\d{3})(\d{3})(\d+)/, '$1-$2-$3') : undefined,
            addressLine1: contactInfo.AddressLine1,
            addressLine2: contactInfo.AddressLine2,
            city: contactInfo.City,
            state: contactInfo.StateOrRegion,
            countryCode: contactInfo.CountryCode,
            zipCode: contactInfo.PostalCode
        };
    }

    return {};
}