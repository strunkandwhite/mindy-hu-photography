import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

let _client: SESClient | null = null;

function getClient(): SESClient {
  if (!_client) {
    _client = new SESClient({
      region: process.env.AWS_REGION!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    });
  }
  return _client;
}

// SES-verified identity used as both sender and recipient. Intentionally not
// the admin-editable contactEmail setting: changing that must not silently
// break notification delivery to an unverified address.
const NOTIFICATION_EMAIL = "humindy@gmail.com";

export async function sendContactNotification({
  name,
  email,
  phone,
  sessionType,
  message,
}: {
  name: string;
  email: string;
  phone: string | null;
  sessionType: string;
  message: string;
}) {
  try {
    await getClient().send(
      new SendEmailCommand({
        Source: NOTIFICATION_EMAIL,
        Destination: {
          ToAddresses: [NOTIFICATION_EMAIL],
        },
        Message: {
          Subject: {
            Data: `New Contact Form Submission — ${sessionType}`,
          },
          Body: {
            Text: {
              Data: [
                `New contact form submission from mindyhuphotography.com`,
                ``,
                `Name: ${name}`,
                `Email: ${email}`,
                `Phone: ${phone || "Not provided"}`,
                `Session Type: ${sessionType}`,
                ``,
                `Message:`,
                message,
              ].join("\n"),
            },
          },
        },
      }),
    );
  } catch (err) {
    // Log the error but don't fail the form submission
    console.error("Failed to send notification email:", err);
  }
}
