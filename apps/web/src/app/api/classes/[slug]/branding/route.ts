import { ApiError } from "@/lib/api/errors";
import { apiSuccess, handleRouteError } from "@/lib/api/responses";
import {
  getBrandingForClass,
  saveBranding,
  toBrandingInput,
} from "@/features/export-branding/service";
import { requireClassManager } from "@/features/classes/class-access";
import { exportBrandingSchema, toFieldErrors } from "@starstask/contracts";

export const dynamic = "force-dynamic";

/** Reads the class's effective branding (saved row or seeded defaults). */
export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params;
    const { class: found } = await requireClassManager(slug);
    const branding = await getBrandingForClass(found.id, found);

    return apiSuccess({ branding });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** Saves branding after validating it at the boundary. */
export async function PUT(
  request: Request,
  context: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await context.params;
    const { class: found } = await requireClassManager(slug);
    const body = (await request.json()) as unknown;
    const parsed = exportBrandingSchema.safeParse(body);

    if (!parsed.success) {
      throw new ApiError(
        400,
        "invalid_input",
        "Fix the highlighted fields.",
        toFieldErrors(parsed.error),
      );
    }

    const saved = await saveBranding(found.id, parsed.data);

    return apiSuccess({ branding: toBrandingInput(saved) });
  } catch (error) {
    return handleRouteError(error);
  }
}
