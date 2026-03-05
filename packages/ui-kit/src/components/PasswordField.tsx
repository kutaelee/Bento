import React from "react";
import { TextField, type TextFieldProps } from "./TextField";

export type PasswordFieldProps = Omit<TextFieldProps, "type">;

export function PasswordField(props: PasswordFieldProps) {
  return <TextField {...props} type="password" />;
}
