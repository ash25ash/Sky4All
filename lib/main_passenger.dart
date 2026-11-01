import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'config/ditto_config.dart';
import 'screens/passenger/passenger_app.dart';
import 'services/ditto_service.dart';
import 'services/i18n_service.dart';

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
      child: const Sky4AllPassengerStandaloneApp(),
    ),
  );
}

class Sky4AllPassengerStandaloneApp extends StatelessWidget {
  const Sky4AllPassengerStandaloneApp({super.key});

  @override
  Widget build(BuildContext context) {
    final ditto = context.watch<DittoService>();
    final i18n = context.watch<I18nService>();

    return MaterialApp(
      title: 'Sky4All — Passenger App',
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
      home: Scaffold(
        backgroundColor: Sky4AllPalette.background,
        body: SafeArea(
          child: Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 480),
              child: SingleChildScrollView(
                child: PassengerAppWidget(
                  ditto: ditto,
                  i18n: i18n,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
