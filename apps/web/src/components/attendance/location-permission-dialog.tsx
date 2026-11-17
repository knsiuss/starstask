"use client";

import { Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";

type Props = {
  open: boolean;
  onCancel: () => void;
  onEnable: () => void | Promise<void>;
  isRequesting?: boolean;
};

/**
 * Explains the upcoming browser permission prompt and triggers a real
 * geolocation request only when the student presses Enable Location.
 */
export function LocationPermissionDialog({
  open,
  onCancel,
  onEnable,
  isRequesting = false,
}: Props) {
  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onCancel();
      }}
    >
      <DialogContent>
        <div className="bg-accent-soft text-accent flex h-12 w-12 items-center justify-center rounded-xl">
          <MapPin
            aria-hidden="true"
            className="h-5 w-5"
          />
        </div>
        <DialogTitle className="mt-4">Location Permission Required</DialogTitle>
        <DialogDescription>
          Please enable your device location and allow location access before
          checking in. Your browser will ask for permission when you tap Enable
          Location.
        </DialogDescription>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button
            onClick={() => void onEnable()}
            disabled={isRequesting}
          >
            {isRequesting ? (
              <>
                <Loader2
                  aria-hidden="true"
                  className="h-4 w-4 animate-spin"
                />
                Requesting…
              </>
            ) : (
              "Enable Location"
            )}
          </Button>
          <Button
            variant="ghost"
            onClick={onCancel}
            disabled={isRequesting}
          >
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
