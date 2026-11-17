export type PickerDoc = {
  id: string;
  name: string;
  mimeType: string;
};

type PickerBuilder = {
  addView: (view: unknown) => PickerBuilder;
  setOAuthToken: (token: string) => PickerBuilder;
  setCallback: (callback: (data: unknown) => void) => PickerBuilder;
  build: () => { setVisible: (visible: boolean) => void };
};

export type GoogleGlobals = {
  accounts: {
    oauth2: {
      initTokenClient: (config: unknown) => {
        requestAccessToken: () => void;
      };
    };
  };
  picker: {
    PickerBuilder: new () => PickerBuilder;
    DocsView: new (viewId: string) => unknown;
    DocsUploadView: new () => unknown;
    Action: { PICKED: string };
  };
};

export function googleGlobals(): GoogleGlobals | null {
  const candidate = (window as unknown as { google?: GoogleGlobals }).google;

  return candidate ?? null;
}

export function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${src}"]`,
    );

    if (existing) {
      resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Could not load Google scripts."));
    document.head.appendChild(script);
  });
}

export function openDrivePicker(
  google: GoogleGlobals,
  token: string,
): Promise<PickerDoc | null> {
  return new Promise((resolve) => {
    const builder = new google.picker.PickerBuilder();
    const view = new google.picker.DocsView("all");
    builder
      .addView(view)
      .setOAuthToken(token)
      .setCallback((data: unknown) => {
        const action = (data as { action?: string } | null)?.action;

        if (action === google.picker.Action.PICKED) {
          const docs = (data as { docs?: PickerDoc[] } | null)?.docs;
          resolve(docs?.[0] ?? null);
        } else {
          resolve(null);
        }
      });
    builder.build().setVisible(true);
  });
}
