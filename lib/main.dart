import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'config/ditto_config.dart';
import 'screens/split_demo_screen.dart';
import 'services/ditto_service.dart';
import 'services/i18n_service.dart';

/// Main entry point for Sky4All (Split Demo + Passenger & Steward Switcher).
/// For separated standalone entrypoints:
/// - Passenger App: `flutter run -t lib/main_passenger.dart`
/// - Steward App:   `flutter run -t lib/main_steward.dart`
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  final dittoService = DittoService();
  await dittoService.initDitto();
  final i18nService = I18nService();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider.value(value: dittoService),
        ChangeNotifierProvider.value(value: i18nService),
      ],
      child: const Sky4AllApp(initialMode: 'split'),
    ),
  );
}

class Sky4AllApp extends StatelessWidget {
  final String initialMode;
  const Sky4AllApp({super.key, this.initialMode = 'split'});

  @override
  Widget build(BuildContext context) {
    final ditto = context.watch<DittoService>();
    final i18n = context.watch<I18nService>();

    return MaterialApp(
      title: 'Sky4All — Live passenger & steward',
      debugShowCheckedModeBanner: false,
      theme: ThemeData(
        useMaterial3: true,
        scaffoldBackgroundColor: Sky4AllPalette.background,
        cardColor: Sky4AllPalette.card,
        primaryColor: Sky4AllPalette.primary,
        colorScheme: ColorScheme.fromSeed(
          seedColor: Sky4AllPalette.primary,
          primary: Sky4AllPalette.primary,
          surface: Sky4AllPalette.card,
        ),
      ),
      home: SplitDemoScreen(
        ditto: ditto,
        i18n: i18n,
        initialMode: initialMode,
      ),
    );
  }
}
