import 'package:flutter/material.dart';

/// Ditto Big Peer Connection & Global Sync Configuration
class DittoConfig {
  // Exact Ditto Big Peer Connection Information provided by user
  static const String databaseId = '965957f9-6fd7-4d2f-8794-d8f1544c5724';
  static const String cloudUrl = 'https://i83inp.cloud.dittolive.app';
  static const String cloudUrlEndpoint =
      'i83inp.cloud.dittolive.app/965957f9-6fd7-4d2f-8794-d8f1544c5724';
  static const String webSocketUrl = 'wss://i83inp.cloud.dittolive.app';
  static const String httpDqlEndpoint =
      'https://i83inp.cloud.dittolive.app/api/v4/store/execute';

  // Local SQL Server Sync Bridge Endpoint (runs on localhost:3001)
  static const String globalSqlServerBridgeUrl = 'http://localhost:3001/api/sync';

  // Ditto Collection Names (matching src/lib/ditto.ts + stewards)
  static const String colPassengers = 'passengers';
  static const String colStewards = 'stewards';
  static const String colRequests = 'requests';
  static const String colOrders = 'orders';
  static const String colFlightRatings = 'flightRatings';
  static const String colSeatComplaints = 'seatComplaints';
  static const String colPassengerRatings = 'passengerRatings';

  // Default Flight Constants
  static const String defaultFlightNumber = 'BA123';
  static const String defaultFlightDate = '31/10/2026';
}

/// Exact OKLCH-converted color palette from src/styles.css
class Sky4AllPalette {
  static const Color background = Color(0xFFDCEBF7); // oklch(0.92 0.035 232)
  static const Color foreground = Color(0xFF202A56); // oklch(0.3 0.07 262)
  static const Color card = Color(0xFFFFFFFF); // oklch(1 0 0)
  static const Color cardForeground = Color(0xFF202A56);
  static const Color primary = Color(0xFF254785); // oklch(0.42 0.11 258)
  static const Color primaryForeground = Color(0xFFF7FAFF);
  static const Color secondary = Color(0xFFCEE2F2); // oklch(0.88 0.04 232)
  static const Color secondaryForeground = Color(0xFF202A56);
  static const Color muted = Color(0xFFD6E6F4); // oklch(0.9 0.03 235)
  static const Color mutedForeground = Color(0xFF536087); // oklch(0.5 0.05 258)
  static const Color accent = Color(0xFFC2DEF4); // oklch(0.86 0.06 230)
  static const Color accentForeground = Color(0xFF202A56);
  static const Color destructive = Color(0xFFDC2626); // oklch(0.577 0.245 27.325)
  static const Color destructiveForeground = Color(0xFFFAFAFC);
  static const Color border = Color(0xFFC5D5E8); // oklch(0.85 0.03 240)
  static const Color input = Color(0xFFC5D5E8);

  // Seat Status Colors
  static const Color seatOk = Color(0xFF47C486); // oklch(0.75 0.15 155)
  static const Color seatOkForeground = Color(0xFF103B26);
  static const Color seatMinor = Color(0xFFF3C63B); // oklch(0.86 0.16 90)
  static const Color seatMinorForeground = Color(0xFF5C4208);
  static const Color seatUrgent = Color(0xFFE13329); // oklch(0.6 0.22 27)
  static const Color seatUrgentForeground = Color(0xFFFFF8F7);
  static const Color seatOwn = Color(0xFF2F6EE5); // oklch(0.55 0.15 255)
  static const Color seatOwnForeground = Color(0xFFF7FAFF);
}
