import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";

export default function RootLayout() {
  return (
    <>
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: "#fafaf8" },
          headerTintColor: "#18181b",
          headerTitleStyle: { fontWeight: "600" },
        }}
      >
        <Stack.Screen name="index" options={{ title: "StarsTask" }} />
      </Stack>
      <StatusBar style="dark" />
    </>
  );
}
