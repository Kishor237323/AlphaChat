import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { supabase } from "../lib/supabase";

type AuthMode = "signup" | "signin";

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [messageType, setMessageType] = useState<"error" | "success">("error");

  const isSignup = mode === "signup";

  async function handleSubmit() {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setMessageType("error");
      setMessage("Enter your email and password.");
      return;
    }
    const cleanDisplayName = displayName.trim();

    if (isSignup && cleanDisplayName.length < 2) {
      setMessageType("error");
      setMessage("Display name must be at least 2 characters.");
      return;
    }
    if (isSignup && password.length < 6) {
      setMessageType("error");
      setMessage("Password must be at least 6 characters.");
      return;
    }

    setLoading(true);
    setMessage("");

    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: {
              display_name: cleanDisplayName,
            },
          },
        });

        if (error) throw error;

        if (!data.session) {
          setMessageType("success");
          setMessage(
            "Account created. Check your email to confirm your address, then return and sign in.",
          );
        } else {
          setMessageType("success");
          setMessage("Account created successfully.");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) throw error;
      }
    } catch (error: unknown) {
      setMessageType("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.card}>
          <Text style={styles.brand}>ALPHA CHAT</Text>

          <Text style={styles.title}>
            {isSignup ? "Create your account" : "Welcome back"}
          </Text>

          <Text style={styles.subtitle}>
            {isSignup
              ? "Join the conversation."
              : "Sign in to continue chatting."}
          </Text>
          
          {isSignup ? (
            <>
              <Text style={styles.label}>Display name</Text>
              <TextInput
                style={styles.input}
                value={displayName}
                onChangeText={setDisplayName}
                placeholder="Enter your display name"
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={40}
              />
            </>
          ) : null}
          <Text style={styles.label}>Email address</Text>
          <TextInput
            style={styles.input}
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="email"
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            value={password}
            onChangeText={setPassword}
            placeholder="Enter your password"
            secureTextEntry
            autoCapitalize="none"
            autoComplete={isSignup ? "new-password" : "current-password"}
          />

          <Pressable
            onPress={handleSubmit}
            disabled={loading}
            style={[styles.button, loading && styles.disabled]}
          >
            {loading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.buttonText}>
                {isSignup ? "Create account" : "Sign in"}
              </Text>
            )}
          </Pressable>

          {message ? (
            <Text
              style={[
                styles.message,
                messageType === "success" ? styles.success : styles.error,
              ]}
            >
              {message}
            </Text>
          ) : null}

          <Pressable
            style={styles.switchButton}
            onPress={() => {
              setMode(isSignup ? "signin" : "signup");
              setMessage("");
            }}
          >
            <Text style={styles.switchText}>
              {isSignup
                ? "Already have an account? Sign in"
                : "New here? Create an account"}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#070B1A",
  },
  content: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },
  card: {
    backgroundColor: "#11182D",
    padding: 24,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "#263354",
  },
  brand: {
    color: "#818CF8",
    fontWeight: "800",
    letterSpacing: 2,
    marginBottom: 12,
  },
  title: {
    fontSize: 26,
    fontWeight: "800",
    color: "#F8FAFC",
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: "#94A3B8",
    marginBottom: 24,
  },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#CBD5E1",
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#334268",
    borderRadius: 10,
    padding: 13,
    fontSize: 15,
    marginBottom: 18,
    color: "#F8FAFC",
    backgroundColor: "#0B1124",
  },
  button: {
    backgroundColor: "#4F46E5",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
  },
  disabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 15,
  },
  message: {
    marginTop: 16,
    padding: 12,
    borderRadius: 8,
    overflow: "hidden",
    fontSize: 13,
    lineHeight: 19,
  },
  success: {
    backgroundColor: "#12352F",
    color: "#6EE7B7",
  },
  error: {
    backgroundColor: "#3A1725",
    color: "#FDA4AF",
  },
  switchButton: {
    alignItems: "center",
    marginTop: 22,
  },
  switchText: {
    color: "#A5B4FC",
    fontWeight: "600",
    textAlign: "center",
  },
});
