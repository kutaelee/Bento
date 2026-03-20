# Bento Mobile Native

This directory contains the experimental native mobile application for Bento, built with React Native and Expo. It is a separate, isolated project to allow for rapid prototyping and validation of a true native mobile experience without affecting the existing Bento web applications.

## Objective

- **Core Problem**: The existing Bento surfaces are web-oriented. This project aims to create a dedicated, native mobile app shell to improve the experience for users on Android and iOS.
- **Business Goal**: Accelerate product evaluation and deployment validation for a native mobile offering by creating a sandboxed experiment.

## Getting Started

1.  **Navigate to the project directory:**
    ```bash
    cd bento-mobile-native
    ```

2.  **Install dependencies:**
    ```bash
    # Using npm
    npm install

    # Or using yarn
    yarn install

    # Or using pnpm
    pnpm install
    ```

3.  **Run the application:**
    ```bash
    # Start the development server
    npx expo start
    ```
    This will open the Expo development tools in your browser. You can then:
    - Scan the QR code with the Expo Go app on your iOS or Android device.
    - Run on an Android emulator/device by pressing `a`.
    - Run on an iOS simulator by pressing `i`.

## Scope

- This project is a net-new scaffold and is intentionally isolated.
- It does not modify any files outside of the `bento-mobile-native/` directory.
- The initial version contains only the basic file structure to launch a "Hello World" style application.
