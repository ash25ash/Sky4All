import 'package:flutter/material.dart';
import '../config/ditto_config.dart';
import '../models/sky4all_models.dart';
import '../services/ditto_service.dart';
import '../services/i18n_service.dart';
import 'passenger/passenger_app.dart';
import 'steward/steward_app.dart';

class SplitDemoScreen extends StatefulWidget {
  final DittoService ditto;
  final I18nService i18n;
  final String initialMode;

  const SplitDemoScreen({
    super.key,
    required this.ditto,
    required this.i18n,
    this.initialMode = 'split',
  });

  @override
  State<SplitDemoScreen> createState() => _SplitDemoScreenState();
}

class _SplitDemoScreenState extends State<SplitDemoScreen> {
  late String _mode;

  @override
  void initState() {
    super.initState();
    _mode = widget.initialMode;
  }

  String _statusText(DittoStatus status, bool ro) {
    switch (status) {
      case DittoStatus.demo:
        return ro ? 'Demo simulat' : 'Simulated demo';
      case DittoStatus.connecting:
        return ro ? 'Se conectează la Ditto…' : 'Connecting to Ditto…';
      case DittoStatus.live:
        return ro ? 'Ditto live' : 'Ditto live';
      case DittoStatus.error:
        return ro ? 'Eroare Ditto — mod demo' : 'Ditto error — demo mode';
    }
  }

  Color _statusDotColor(DittoStatus status) {
    switch (status) {
      case DittoStatus.live:
        return Sky4AllPalette.seatOk;
      case DittoStatus.connecting:
        return Sky4AllPalette.seatMinor;
      case DittoStatus.error:
        return Sky4AllPalette.seatUrgent;
      case DittoStatus.demo:
        return Sky4AllPalette.mutedForeground.withOpacity(0.4);
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.i18n.t;
    final ro = widget.i18n.isRo;
    final status = widget.ditto.status;

    return Scaffold(
      backgroundColor: Sky4AllPalette.background,
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Wrap(
                alignment: WrapAlignment.spaceBetween,
                crossAxisAlignment: WrapCrossAlignment.center,
                spacing: 12,
                runSpacing: 8,
                children: [
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.flight,
                        size: 26,
                        color: Sky4AllPalette.primary,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        t('appName'),
                        style: const TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w800,
                          color: Sky4AllPalette.primary,
                        ),
                      ),
                    ],
                  ),
                  Wrap(
                    spacing: 6,
                    children: [
                      _modeChip('split', 'Split Demo (/)'),
                      _modeChip('passenger', '${t('passenger')} App (/p)'),
                      _modeChip('steward', '${t('steward')} App (/s)'),
                    ],
                  ),
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: _statusDotColor(status),
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        '${t('liveDemo')} · ${_statusText(status, ro)}',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          color: Sky4AllPalette.mutedForeground,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              const SizedBox(height: 16),
              if (_mode == 'passenger')
                Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 420),
                    child: _buildPhoneMockup(
                      child: PassengerAppWidget(
                        ditto: widget.ditto,
                        i18n: widget.i18n,
                      ),
                    ),
                  ),
                )
              else if (_mode == 'steward')
                Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 1024),
                    child: _buildTabletMockup(
                      child: StewardAppWidget(
                        ditto: widget.ditto,
                        i18n: widget.i18n,
                      ),
                    ),
                  ),
                )
              else
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: ConstrainedBox(
                    constraints: BoxConstraints(
                      minWidth: 780,
                      maxWidth: MediaQuery.of(context).size.width > 780
                          ? MediaQuery.of(context).size.width - 32
                          : 1120,
                    ),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        SizedBox(
                          width: 400,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    t('passenger').toUpperCase(),
                                    style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 0.6,
                                      color: Sky4AllPalette.mutedForeground,
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              _buildPhoneMockup(
                                child: PassengerAppWidget(
                                  ditto: widget.ditto,
                                  i18n: widget.i18n,
                                ),
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 16),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    t('steward').toUpperCase(),
                                    style: const TextStyle(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w800,
                                      letterSpacing: 0.6,
                                      color: Sky4AllPalette.mutedForeground,
                                    ),
                                  ),
                                  InkWell(
                                    onTap: () =>
                                        setState(() => _mode = 'steward'),
                                    child: Text(
                                      t('openSteward'),
                                      style: const TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w700,
                                        color: Sky4AllPalette.primary,
                                        decoration: TextDecoration.underline,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              _buildTabletMockup(
                                child: StewardAppWidget(
                                  ditto: widget.ditto,
                                  i18n: widget.i18n,
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _modeChip(String mode, String label) {
    final active = _mode == mode;
    return InkWell(
      onTap: () => setState(() => _mode = mode),
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: active ? Sky4AllPalette.primary : Sky4AllPalette.card,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: Sky4AllPalette.border),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: active
                ? Sky4AllPalette.primaryForeground
                : Sky4AllPalette.foreground,
          ),
        ),
      ),
    );
  }

  Widget _buildPhoneMockup({required Widget child}) {
    return Container(
      height: 640,
      decoration: BoxDecoration(
        color: Sky4AllPalette.background,
        borderRadius: BorderRadius.circular(32),
        border: Border.all(
          color: Sky4AllPalette.foreground.withOpacity(0.85),
          width: 8,
        ),
        boxShadow: const [
          BoxShadow(
            color: Colors.black12,
            blurRadius: 18,
            offset: Offset(0, 8),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: SingleChildScrollView(child: child),
    );
  }

  Widget _buildTabletMockup({required Widget child}) {
    return Container(
      height: 640,
      decoration: BoxDecoration(
        color: Sky4AllPalette.background,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(
          color: Sky4AllPalette.foreground.withOpacity(0.85),
          width: 8,
        ),
        boxShadow: const [
          BoxShadow(
            color: Colors.black12,
            blurRadius: 18,
            offset: Offset(0, 8),
          ),
        ],
      ),
      clipBehavior: Clip.antiAlias,
      child: SingleChildScrollView(child: child),
    );
  }
}
