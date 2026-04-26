import { SESClient, SendEmailCommand } from "@aws-sdk/client-ses";

const ses = new SESClient({
  region: process.env.AWS_REGION || "us-east-1",
});

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
    await ses.send(
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
