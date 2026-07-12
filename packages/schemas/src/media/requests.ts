import { z } from "zod";
import { fileSchema } from "./fields";

export const mediaUploadSchema = z.object({
  file: fileSchema,
  revision_id: z.uuid(),
});

export type MediaUploadInput = z.infer<typeof mediaUploadSchema>;
