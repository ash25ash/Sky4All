import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/material.dart';
import '../../config/ditto_config.dart';
import '../../models/sky4all_models.dart';
import '../../services/ditto_service.dart';
import '../../services/i18n_service.dart';
import '../../widgets/order_menu_widget.dart';
import '../../widgets/seat_map_widget.dart';

class PassengerAppWidget extends StatefulWidget {
  final DittoService ditto;
  final I18nService i18n;

  const PassengerAppWidget({
    super.key,
    required this.ditto,
    required this.i18n,
  });

  @override
  State<PassengerAppWidget> createState() => _PassengerAppWidgetState();
}

enum _PassengerView { home, order, rate, seatmap }

class _PassengerAppWidgetState extends State<PassengerAppWidget> {
  static const List<Map<String, String>> _allergiesList = [
    {'en': 'Peanuts', 'ro': 'Arahide'},
    {'en': 'Tree nuts', 'ro': 'Nuci'},
    {'en': 'Milk / lactose', 'ro': 'Lapte / lactoză'},
    {'en': 'Eggs', 'ro': 'Ouă'},
    {'en': 'Gluten', 'ro': 'Gluten'},
    {'en': 'Soy', 'ro': 'Soia'},
    {'en': 'Fish', 'ro': 'Pește'},
    {'en': 'Shellfish', 'ro': 'Fructe de mare'},
    {'en': 'Sesame', 'ro': 'Susan'},
    {'en': 'Penicillin', 'ro': 'Penicilină'},
    {'en': 'Latex', 'ro': 'Latex'},
    {'en': 'Pollen', 'ro': 'Polen'},
    {'en': 'Other', 'ro': 'Altele'},
  ];

  static const List<Map<String, String>> _emergenciesList = [
    {'en': 'Cardiac problem', 'ro': 'Problemă cardiacă'},
    {'en': 'Hypoglycemia', 'ro': 'Criză de hipoglicemie'},
    {'en': 'Fainting', 'ro': 'Stare de leșin'},
    {'en': 'Dizziness', 'ro': 'Amețeală'},
    {'en': 'Breathing problems', 'ro': 'Probleme respiratorii'},
  ];

  static const List<String> _conditions = [
    'diabetes',
    'asthma',
    'heartCondition',
    'epilepsy',
    'pregnancy',
    'allergies',
    'none',
  ];

  static const List<String> _ratingCategories = [
    'turbulence',
    'staffBehaviour',
    'cleanliness',
    'legroom',
    'bagSpace',
  ];

  String? _flightId;
  String _flightDateStr = '';
  DateTime? _flightDay;
  final TextEditingController _codeCtrl = TextEditingController();

  String? _seat;
  int _row = 1;
  String _letter = 'A';

  final TextEditingController _nameCtrl = TextEditingController();
  final TextEditingController _otherAllergyCtrl = TextEditingController();
  final TextEditingController _otherEmergencyCtrl = TextEditingController();

  List<String> _selectedConditions = [];
  List<String> _selectedAllergies = [];
  bool _profileDone = false;

  _PassengerView _view = _PassengerView.home;
  bool _confirmingEmergency = false;
  String? _complaintSeat;

  @override
  void dispose() {
    _codeCtrl.dispose();
    _nameCtrl.dispose();
    _otherAllergyCtrl.dispose();
    _otherEmergencyCtrl.dispose();
    super.dispose();
  }

  String _formatDay(DateTime d) {
    final dd = d.day.toString().padLeft(2, '0');
    final mm = d.month.toString().padLeft(2, '0');
    final yyyy = d.year.toString();
    return '$dd/$mm/$yyyy';
  }

  String _formatDayPretty(DateTime d) {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    final dd = d.day.toString().padLeft(2, '0');
    return '$dd ${months[d.month - 1]} ${d.year}';
  }

  Future<void> _pickFlightDay(BuildContext context) async {
    final now = DateTime(2026, 10, 31);
    final picked = await showDatePicker(
      context: context,
      initialDate: _flightDay ?? now,
      firstDate: DateTime(2024, 1, 1),
      lastDate: DateTime(2030, 12, 31),
    );
    if (picked != null) {
      setState(() {
        _flightDay = picked;
        _flightDateStr = _formatDay(picked);
      });
    }
  }

  void _sendMedical(String emergency) {
    final currentSeat = _seat;
    final currentFlight = _flightId;
    if (currentSeat == null || currentFlight == null) return;

    final t = widget.i18n.t;
    final condLabels = _selectedConditions
        .where((c) => c != 'none')
        .map((c) => t(c))
        .toList();

    widget.ditto.insertRequest(
      type: RequestType.medical_emergency,
      seat: currentSeat,
      flightId: currentFlight,
      flightDate: _flightDateStr.isNotEmpty ? _flightDateStr : '31/10/2026',
      payload: {
        'emergency': emergency,
        'conditions': condLabels,
      },
    );

    setState(() {
      _confirmingEmergency = false;
      _otherEmergencyCtrl.clear();
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.i18n.t;

    return Container(
      color: Sky4AllPalette.background,
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                t('appName'),
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: Sky4AllPalette.primary,
                ),
              ),
              LangSwitcher(i18n: widget.i18n),
            ],
          ),
          const SizedBox(height: 12),
          if (_flightId == null)
            _buildStep1FlightDetection(context, t)
          else if (_seat == null)
            _buildStep2SeatSelection(t)
          else if (!_profileDone)
            _buildStep3Profile(t)
          else
            _buildMainPassengerViews(t),
        ],
      ),
    );
  }

  Widget _buildStep1FlightDetection(
    BuildContext context,
    String Function(String) t,
  ) {
    final hasCode = _codeCtrl.text.trim().isNotEmpty;
    return Container(
      decoration: BoxDecoration(
        color: Sky4AllPalette.card,
        borderRadius: BorderRadius.circular(16),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  t('flightPrompt'),
                  textAlign: TextAlign.center,
                  style: const TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: Sky4AllPalette.foreground,
                  ),
                ),
                const SizedBox(height: 14),
                Text(
                  t('flightNumber').toUpperCase(),
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.6,
                    color: Sky4AllPalette.mutedForeground,
                  ),
                ),
                const SizedBox(height: 6),
                TextField(
                  controller: _codeCtrl,
                  textCapitalization: TextCapitalization.characters,
                  onChanged: (val) {
                    setState(() {});
                  },
                  decoration: InputDecoration(
                    isDense: true,
                    contentPadding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 12,
                    ),
                    filled: true,
                    fillColor: Sky4AllPalette.background,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: const BorderSide(color: Sky4AllPalette.border),
                    ),
                  ),
                ),
                const SizedBox(height: 12),
                Text(
                  t('flightDay').toUpperCase(),
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.6,
                    color: Sky4AllPalette.mutedForeground,
                  ),
                ),
                const SizedBox(height: 6),
                InkWell(
                  onTap: () => _pickFlightDay(context),
                  borderRadius: BorderRadius.circular(12),
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 12,
                    ),
                    decoration: BoxDecoration(
                      color: Sky4AllPalette.background,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: Sky4AllPalette.border),
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.calendar_today_outlined,
                          size: 16,
                          color: Sky4AllPalette.mutedForeground,
                        ),
                        const SizedBox(width: 8),
                        Text(
                          _flightDay != null
                              ? _formatDayPretty(_flightDay!)
                              : t('pickDay'),
                          style: TextStyle(
                            fontSize: 14,
                            color: _flightDay != null
                                ? Sky4AllPalette.foreground
                                : Sky4AllPalette.mutedForeground,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 14),
                ElevatedButton(
                  onPressed: hasCode
                      ? () {
                          setState(() {
                            _flightId = _codeCtrl.text.trim().toUpperCase();
                            if (_flightDateStr.isEmpty) {
                              _flightDateStr = '31/10/2026';
                            }
                          });
                        }
                      : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Sky4AllPalette.primary,
                    foregroundColor: Sky4AllPalette.primaryForeground,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: Text(
                    t('continue'),
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ),
          SizedBox(
            height: 220,
            child: Stack(
              fit: StackFit.expand,
              children: [
                Image.asset(
                  'assets/images/airplane.png',
                  fit: BoxFit.cover,
                ),
                Align(
                  alignment: Alignment.bottomCenter,
                  child: Container(
                    width: double.infinity,
                    padding: const EdgeInsets.fromLTRB(16, 36, 16, 20),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        begin: Alignment.bottomCenter,
                        end: Alignment.topCenter,
                        colors: [
                          Sky4AllPalette.primary.withOpacity(0.85),
                          Colors.transparent,
                        ],
                      ),
                    ),
                    child: const Text(
                      '“YOUR COMFORT, OUR PRIORITY”',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 2.4,
                        color: Sky4AllPalette.primaryForeground,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStep2SeatSelection(String Function(String) t) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Sky4AllPalette.card,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            t('selectSeat'),
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: Sky4AllPalette.foreground,
            ),
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      t('row'),
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    DropdownButtonFormField<int>(
                      value: _row,
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: Sky4AllPalette.background,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      items: List.generate(
                        30,
                        (i) => DropdownMenuItem(
                          value: i + 1,
                          child: Text('${i + 1}'),
                        ),
                      ),
                      onChanged: (v) {
                        if (v != null) setState(() => _row = v);
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      t('letter'),
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 4),
                    DropdownButtonFormField<String>(
                      value: _letter,
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: Sky4AllPalette.background,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(12),
                        ),
                      ),
                      items: ['A', 'B', 'C', 'D', 'E', 'F']
                          .map(
                            (l) => DropdownMenuItem(
                              value: l,
                              child: Text(l),
                            ),
                          )
                          .toList(),
                      onChanged: (v) {
                        if (v != null) setState(() => _letter = v);
                      },
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ElevatedButton(
            onPressed: () {
              setState(() {
                _seat = '$_row$_letter';
              });
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: Sky4AllPalette.primary,
              foregroundColor: Sky4AllPalette.primaryForeground,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: Text(
              t('continue'),
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStep3Profile(String Function(String) t) {
    final ro = widget.i18n.isRo;
    final langKey = ro ? 'ro' : 'en';

    void toggleCondition(String c) {
      setState(() {
        if (c == 'none') {
          _selectedConditions = ['none'];
        } else {
          _selectedConditions.remove('none');
          if (_selectedConditions.contains(c)) {
            _selectedConditions.remove(c);
          } else {
            _selectedConditions.add(c);
          }
        }
      });
    }

    void toggleAllergy(String enName) {
      setState(() {
        if (_selectedAllergies.contains(enName)) {
          _selectedAllergies.remove(enName);
        } else {
          _selectedAllergies.add(enName);
        }
      });
    }

    void finishProfile() {
      final currentSeat = _seat ?? '14C';
      final currentFlight = _flightId ?? 'BA123';
      final inputName = _nameCtrl.text.trim();

      final verifiedPax = validatePassengerCredentials(
        name: inputName,
        flightNumber: currentFlight,
        flightDate: _flightDateStr.isNotEmpty ? _flightDateStr : '31/10/2026',
        seatNumber: currentSeat,
      );

      final formattedConditions = _selectedConditions
          .where((c) => c != 'none')
          .map((c) {
            if (c != 'allergies') return t(c);
            final list = _selectedAllergies
                .where((a) => a != 'Other')
                .map(
                  (a) =>
                      _allergiesList.firstWhere((x) => x['en'] == a)[langKey]!,
                )
                .toList();
            if (_selectedAllergies.contains('Other') &&
                _otherAllergyCtrl.text.trim().isNotEmpty) {
              list.add(_otherAllergyCtrl.text.trim());
            }
            return list.isNotEmpty ? '${t(c)}: ${list.join(', ')}' : t(c);
          })
          .toList();

      final finalConditions = formattedConditions.isNotEmpty
          ? formattedConditions
          : (verifiedPax?.medicalConditions ?? <String>[]);

      widget.ditto.insertPassenger(
        id: verifiedPax?.id,
        name: verifiedPax?.name ?? (inputName.isNotEmpty ? inputName : 'Anonymous'),
        seat: currentSeat,
        flightId: currentFlight,
        flightDate: _flightDateStr.isNotEmpty ? _flightDateStr : '31/10/2026',
        medicalConditions: finalConditions,
      );

      setState(() => _profileDone = true);
    }

    return Container(
      decoration: BoxDecoration(
        color: Sky4AllPalette.card,
        borderRadius: BorderRadius.circular(16),
      ),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
            color: Sky4AllPalette.primary,
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    _nameCtrl.text.trim().isNotEmpty
                        ? _nameCtrl.text.trim()
                        : t('yourProfile'),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: Sky4AllPalette.primaryForeground,
                    ),
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 4,
                  ),
                  decoration: BoxDecoration(
                    color: Sky4AllPalette.primaryForeground.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(
                        Icons.event_seat,
                        size: 16,
                        color: Sky4AllPalette.primaryForeground,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        _seat ?? '',
                        style: const TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: Sky4AllPalette.primaryForeground,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  t('name').toUpperCase(),
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.6,
                    color: Sky4AllPalette.mutedForeground,
                  ),
                ),
                const SizedBox(height: 6),
                TextField(
                  controller: _nameCtrl,
                  onChanged: (_) => setState(() {}),
                  decoration: InputDecoration(
                    hintText: t('name'),
                    filled: true,
                    fillColor: Sky4AllPalette.background,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                Text(
                  t('medicalConditions').toUpperCase(),
                  style: const TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.6,
                    color: Sky4AllPalette.mutedForeground,
                  ),
                ),
                const SizedBox(height: 8),
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: _conditions.map((c) {
                    final on = _selectedConditions.contains(c);
                    return InkWell(
                      onTap: () => toggleCondition(c),
                      borderRadius: BorderRadius.circular(12),
                      child: Container(
                        width: c == 'none' ? double.infinity : 150,
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 12,
                        ),
                        decoration: BoxDecoration(
                          color: on
                              ? Sky4AllPalette.accent
                              : Sky4AllPalette.background,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: on
                                ? Sky4AllPalette.primary
                                : Sky4AllPalette.border,
                            width: 2,
                          ),
                        ),
                        child: Row(
                          mainAxisAlignment: c == 'none'
                              ? MainAxisAlignment.center
                              : MainAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 20,
                              height: 20,
                              decoration: BoxDecoration(
                                color: on
                                    ? Sky4AllPalette.primary
                                    : Colors.transparent,
                                borderRadius: BorderRadius.circular(6),
                                border: Border.all(
                                  color: on
                                      ? Sky4AllPalette.primary
                                      : Sky4AllPalette.mutedForeground,
                                  width: 2,
                                ),
                              ),
                              alignment: Alignment.center,
                              child: on
                                  ? const Text(
                                      '✓',
                                      style: TextStyle(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w800,
                                        color: Sky4AllPalette.primaryForeground,
                                      ),
                                    )
                                  : null,
                            ),
                            const SizedBox(width: 8),
                            Flexible(
                              child: Text(
                                t(c),
                                style: TextStyle(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w600,
                                  color: on
                                      ? Sky4AllPalette.accentForeground
                                      : Sky4AllPalette.foreground,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  }).toList(),
                ),
                if (_selectedConditions.contains('allergies')) ...[
                  const SizedBox(height: 10),
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: Sky4AllPalette.secondary.withOpacity(0.6),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        Text(
                          (ro ? 'Alege alergiile' : 'Choose your allergies')
                              .toUpperCase(),
                          style: const TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w700,
                            letterSpacing: 0.6,
                            color: Sky4AllPalette.mutedForeground,
                          ),
                        ),
                        const SizedBox(height: 8),
                        Wrap(
                          spacing: 6,
                          runSpacing: 6,
                          children: _allergiesList.map((a) {
                            final enName = a['en']!;
                            final on = _selectedAllergies.contains(enName);
                            return InkWell(
                              onTap: () => toggleAllergy(enName),
                              borderRadius: BorderRadius.circular(999),
                              child: Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 12,
                                  vertical: 6,
                                ),
                                decoration: BoxDecoration(
                                  color: on
                                      ? Sky4AllPalette.primary
                                      : Sky4AllPalette.background,
                                  borderRadius: BorderRadius.circular(999),
                                  border: on
                                      ? null
                                      : Border.all(
                                          color: Sky4AllPalette.border,
                                        ),
                                ),
                                child: Text(
                                  a[langKey]!,
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w600,
                                    color: on
                                        ? Sky4AllPalette.primaryForeground
                                        : Sky4AllPalette.foreground,
                                  ),
                                ),
                              ),
                            );
                          }).toList(),
                        ),
                        if (_selectedAllergies.contains('Other')) ...[
                          const SizedBox(height: 8),
                          TextField(
                            controller: _otherAllergyCtrl,
                            decoration: InputDecoration(
                              hintText: ro
                                  ? 'Scrie alergia...'
                                  : 'Type your allergy...',
                              isDense: true,
                              filled: true,
                              fillColor: Sky4AllPalette.background,
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                ElevatedButton(
                  onPressed: finishProfile,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Sky4AllPalette.primary,
                    foregroundColor: Sky4AllPalette.primaryForeground,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                  ),
                  child: Text(
                    t('save'),
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
                TextButton(
                  onPressed: () => setState(() => _profileDone = true),
                  child: Text(
                    t('skip'),
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Sky4AllPalette.mutedForeground,
                      decoration: TextDecoration.underline,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMainPassengerViews(String Function(String) t) {
    final currentSeat = _seat ?? '14C';
    final currentFlight = _flightId ?? 'BA123';
    final currentDate =
        _flightDateStr.isNotEmpty ? _flightDateStr : '31/10/2026';
    final ro = widget.i18n.isRo;
    final langKey = ro ? 'ro' : 'en';

    switch (_view) {
      case _PassengerView.order:
        return OrderMenuWidget(
          seat: currentSeat,
          flightId: currentFlight,
          flightDate: currentDate,
          ditto: widget.ditto,
          i18n: widget.i18n,
          onBack: () => setState(() => _view = _PassengerView.home),
        );
      case _PassengerView.rate:
        return _RateFlightView(
          seat: currentSeat,
          flightId: currentFlight,
          flightDate: currentDate,
          ditto: widget.ditto,
          i18n: widget.i18n,
          categories: _ratingCategories,
          onBack: () => setState(() => _view = _PassengerView.home),
        );
      case _PassengerView.seatmap:
        return _PassengerSeatMapView(
          ownSeat: currentSeat,
          flightId: currentFlight,
          flightDate: currentDate,
          ditto: widget.ditto,
          i18n: widget.i18n,
          complaintSeat: _complaintSeat,
          onSelectComplaintSeat: (s) => setState(() => _complaintSeat = s),
          onBack: () => setState(() => _view = _PassengerView.home),
        );
      case _PassengerView.home:
        final myRequests = widget.ditto.requests
            .where((r) => seatsMatch(r.seat, currentSeat))
            .toList()
          ..sort((a, b) => b.createdAt.compareTo(a.createdAt));

        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            InkWell(
              onTap: () =>
                  setState(() => _confirmingEmergency = !_confirmingEmergency),
              borderRadius: BorderRadius.circular(16),
              child: Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: Sky4AllPalette.destructive,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Row(
                  children: [
                    const Icon(
                      Icons.warning_amber_rounded,
                      size: 28,
                      color: Sky4AllPalette.destructiveForeground,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        t('medicalEmergency'),
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w800,
                          color: Sky4AllPalette.destructiveForeground,
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
            if (_confirmingEmergency) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: Sky4AllPalette.card,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: Sky4AllPalette.destructive,
                    width: 2,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      (ro ? 'Ce se întâmplă?' : 'What is happening?')
                          .toUpperCase(),
                      style: const TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w800,
                        letterSpacing: 0.6,
                        color: Sky4AllPalette.destructive,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: _emergenciesList.map((e) {
                        final label = e[langKey]!;
                        return InkWell(
                          onTap: () => _sendMedical(label),
                          borderRadius: BorderRadius.circular(12),
                          child: Container(
                            width: 155,
                            padding: const EdgeInsets.symmetric(
                              horizontal: 12,
                              vertical: 12,
                            ),
                            decoration: BoxDecoration(
                              color:
                                  Sky4AllPalette.destructive.withOpacity(0.1),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: Text(
                              label,
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: Sky4AllPalette.destructive,
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _otherEmergencyCtrl,
                            decoration: InputDecoration(
                              hintText: ro ? 'Altele...' : 'Other...',
                              isDense: true,
                              filled: true,
                              fillColor: Sky4AllPalette.background,
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(12),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        ElevatedButton(
                          onPressed: () {
                            final text = _otherEmergencyCtrl.text.trim();
                            if (text.isNotEmpty) {
                              _sendMedical(text);
                            }
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Sky4AllPalette.destructive,
                            foregroundColor:
                                Sky4AllPalette.destructiveForeground,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: Text(
                            t('send'),
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 12),
            _homeActionCard(
              icon: Icons.notifications_none_rounded,
              label: t('callSteward'),
              onTap: () => widget.ditto.insertRequest(
                type: RequestType.call_steward,
                seat: currentSeat,
                flightId: currentFlight,
                flightDate: currentDate,
              ),
            ),
            const SizedBox(height: 12),
            _homeActionCard(
              icon: Icons.shopping_cart_outlined,
              label: t('orderSnacks'),
              onTap: () => setState(() => _view = _PassengerView.order),
            ),
            const SizedBox(height: 12),
            _homeActionCard(
              icon: Icons.star_border_rounded,
              label: t('rateFlight'),
              onTap: () => setState(() => _view = _PassengerView.rate),
            ),
            const SizedBox(height: 12),
            _homeActionCard(
              icon: Icons.feedback_outlined,
              label: t('complaints'),
              onTap: () => setState(() => _view = _PassengerView.seatmap),
            ),
            if (myRequests.isNotEmpty) ...[
              const SizedBox(height: 16),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Sky4AllPalette.card,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      t('yourRequests'),
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: Sky4AllPalette.foreground,
                      ),
                    ),
                    const SizedBox(height: 8),
                    ...myRequests.map((r) {
                      return Padding(
                        padding: const EdgeInsets.symmetric(vertical: 4),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              t(_requestTypeLabelKey(r.type)),
                              style: const TextStyle(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            _buildStatusBadge(r.status, t),
                          ],
                        ),
                      );
                    }),
                  ],
                ),
              ),
            ],
          ],
        );
    }
  }

  Widget _homeActionCard({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          color: Sky4AllPalette.card,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          children: [
            Icon(icon, size: 28, color: Sky4AllPalette.primary),
            const SizedBox(width: 12),
            Expanded(
              child: Text(
                label,
                style: const TextStyle(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: Sky4AllPalette.foreground,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  String _requestTypeLabelKey(RequestType type) {
    switch (type) {
      case RequestType.medical_emergency:
        return 'medicalEmergency';
      case RequestType.call_steward:
        return 'callSteward';
      case RequestType.order:
        return 'orderSnacks';
      case RequestType.complaint:
        return 'complaints';
    }
  }

  Widget _buildStatusBadge(
    RequestStatus status,
    String Function(String) t,
  ) {
    Color bg;
    Color fg;
    String key;
    switch (status) {
      case RequestStatus.newRequest:
        bg = Sky4AllPalette.secondary;
        fg = Sky4AllPalette.secondaryForeground;
        key = 'statusSent';
        break;
      case RequestStatus.seen:
        bg = Sky4AllPalette.accent;
        fg = Sky4AllPalette.accentForeground;
        key = 'statusSeen';
        break;
      case RequestStatus.in_progress:
        bg = Sky4AllPalette.seatMinor;
        fg = Sky4AllPalette.seatMinorForeground;
        key = 'statusInProgress';
        break;
      case RequestStatus.resolved:
        bg = Sky4AllPalette.seatOk;
        fg = Sky4AllPalette.seatOkForeground;
        key = 'statusResolved';
        break;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        t(key),
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: fg,
        ),
      ),
    );
  }
}

class _RateFlightView extends StatefulWidget {
  final String seat;
  final String flightId;
  final String flightDate;
  final DittoService ditto;
  final I18nService i18n;
  final List<String> categories;
  final VoidCallback onBack;

  const _RateFlightView({
    required this.seat,
    required this.flightId,
    required this.flightDate,
    required this.ditto,
    required this.i18n,
    required this.categories,
    required this.onBack,
  });

  @override
  State<_RateFlightView> createState() => _RateFlightViewState();
}

class _RateFlightViewState extends State<_RateFlightView> {
  final Map<String, int> _scores = {};
  final TextEditingController _commentCtrl = TextEditingController();
  bool _done = false;

  @override
  void dispose() {
    _commentCtrl.dispose();
    super.dispose();
  }

  void _submit() {
    widget.ditto.insertFlightRating(
      seat: widget.seat,
      flightId: widget.flightId,
      flightDate: widget.flightDate,
      turbulence: _scores['turbulence'] ?? 3,
      staffBehaviour: _scores['staffBehaviour'] ?? 3,
      cleanliness: _scores['cleanliness'] ?? 3,
      legroom: _scores['legroom'] ?? 3,
      bagSpace: _scores['bagSpace'] ?? 3,
      comment: _commentCtrl.text.trim().isEmpty
          ? null
          : _commentCtrl.text.trim(),
    );
    setState(() => _done = true);
    Future.delayed(const Duration(milliseconds: 1500), () {
      if (mounted) widget.onBack();
    });
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.i18n.t;
    if (_done) {
      return Container(
        padding: const EdgeInsets.all(24),
        decoration: BoxDecoration(
          color: Sky4AllPalette.card,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(
          t('thanks'),
          textAlign: TextAlign.center,
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.w700,
            color: Sky4AllPalette.seatOkForeground,
          ),
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Sky4AllPalette.card,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: widget.onBack,
              icon: const Icon(Icons.chevron_left, size: 18),
              label: Text(t('back')),
              style: TextButton.styleFrom(
                foregroundColor: Sky4AllPalette.primary,
                padding: EdgeInsets.zero,
              ),
            ),
          ),
          Text(
            t('rateFlight'),
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: Sky4AllPalette.foreground,
            ),
          ),
          const SizedBox(height: 12),
          ...widget.categories.map((cat) {
            final currentScore = _scores[cat] ?? 0;
            return Padding(
              padding: const EdgeInsets.symmetric(vertical: 6),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    t(cat),
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  Row(
                    children: List.generate(5, (index) {
                      final n = index + 1;
                      final filled = currentScore >= n;
                      return InkWell(
                        onTap: () => setState(() => _scores[cat] = n),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 2),
                          child: Icon(
                            filled
                                ? Icons.star_rounded
                                : Icons.star_border_rounded,
                            size: 26,
                            color: filled
                                ? Sky4AllPalette.seatMinor
                                : Sky4AllPalette.mutedForeground,
                          ),
                        ),
                      );
                    }),
                  ),
                ],
              ),
            );
          }),
          const SizedBox(height: 12),
          TextField(
            controller: _commentCtrl,
            maxLines: 2,
            decoration: InputDecoration(
              hintText: t('comment'),
              filled: true,
              fillColor: Sky4AllPalette.background,
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
          ),
          const SizedBox(height: 12),
          ElevatedButton(
            onPressed: _submit,
            style: ElevatedButton.styleFrom(
              backgroundColor: Sky4AllPalette.primary,
              foregroundColor: Sky4AllPalette.primaryForeground,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: Text(
              t('submitRating'),
              style: const TextStyle(
                fontSize: 16,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _PassengerSeatMapView extends StatefulWidget {
  final String ownSeat;
  final String flightId;
  final String flightDate;
  final DittoService ditto;
  final I18nService i18n;
  final String? complaintSeat;
  final void Function(String? seat) onSelectComplaintSeat;
  final VoidCallback onBack;

  const _PassengerSeatMapView({
    required this.ownSeat,
    required this.flightId,
    required this.flightDate,
    required this.ditto,
    required this.i18n,
    required this.complaintSeat,
    required this.onSelectComplaintSeat,
    required this.onBack,
  });

  @override
  State<_PassengerSeatMapView> createState() => _PassengerSeatMapViewState();
}

class _PassengerSeatMapViewState extends State<_PassengerSeatMapView> {
  String _category = 'noise';
  final TextEditingController _textCtrl = TextEditingController();

  @override
  void dispose() {
    _textCtrl.dispose();
    super.dispose();
  }

  void _submitComplaint() {
    final target = widget.complaintSeat;
    if (target == null) return;
    final text = _textCtrl.text.trim();

    widget.ditto.insertSeatComplaint(
      fromSeat: widget.ownSeat,
      targetSeat: target,
      flightId: widget.flightId,
      flightDate: widget.flightDate,
      category: _category,
      text: text,
    );
    widget.ditto.insertRequest(
      type: RequestType.complaint,
      seat: widget.ownSeat,
      flightId: widget.flightId,
      flightDate: widget.flightDate,
      payload: {
        'targetSeat': target,
        'category': _category,
        'text': text,
      },
    );

    widget.onSelectComplaintSeat(null);
    _textCtrl.clear();
  }

  @override
  Widget build(BuildContext context) {
    final t = widget.i18n.t;
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Sky4AllPalette.card,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Align(
            alignment: Alignment.centerLeft,
            child: TextButton.icon(
              onPressed: widget.onBack,
              icon: const Icon(Icons.chevron_left, size: 18),
              label: Text(t('back')),
              style: TextButton.styleFrom(
                foregroundColor: Sky4AllPalette.primary,
                padding: EdgeInsets.zero,
              ),
            ),
          ),
          Text(
            t('tapSeatToComplain'),
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: Sky4AllPalette.mutedForeground,
            ),
          ),
          const SizedBox(height: 8),
          Container(
            height: 320,
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: Sky4AllPalette.secondary.withOpacity(0.5),
              borderRadius: BorderRadius.circular(12),
            ),
            child: SingleChildScrollView(
              child: SeatMapWidget(
                compact: true,
                getStatus: (s) => seatsMatch(s, widget.ownSeat)
                    ? SeatStatus.own
                    : SeatStatus.idle,
                selectedSeat: widget.complaintSeat,
                onSeatClick: (s) {
                  if (!seatsMatch(s, widget.ownSeat)) {
                    widget.onSelectComplaintSeat(s);
                  }
                },
              ),
            ),
          ),
          if (widget.complaintSeat != null) ...[
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                border: Border.all(color: Sky4AllPalette.border),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    '${t('complaintAbout')} ${widget.complaintSeat}',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: ['noise', 'behaviour', 'other'].map((c) {
                      final active = _category == c;
                      return Expanded(
                        child: Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 2),
                          child: InkWell(
                            onTap: () => setState(() => _category = c),
                            borderRadius: BorderRadius.circular(999),
                            child: Container(
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              decoration: BoxDecoration(
                                color: active
                                    ? Sky4AllPalette.primary
                                    : Sky4AllPalette.secondary,
                                borderRadius: BorderRadius.circular(999),
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                t(c),
                                style: TextStyle(
                                  fontSize: 12,
                                  fontWeight: FontWeight.w700,
                                  color: active
                                      ? Sky4AllPalette.primaryForeground
                                      : Sky4AllPalette.secondaryForeground,
                                ),
                              ),
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                  const SizedBox(height: 8),
                  TextField(
                    controller: _textCtrl,
                    maxLines: 2,
                    decoration: InputDecoration(
                      hintText: t('describe'),
                      filled: true,
                      fillColor: Sky4AllPalette.background,
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton(
                          onPressed: _submitComplaint,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Sky4AllPalette.primary,
                            foregroundColor: Sky4AllPalette.primaryForeground,
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(12),
                            ),
                          ),
                          child: Text(
                            t('send'),
                            style: const TextStyle(fontWeight: FontWeight.w700),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      OutlinedButton(
                        onPressed: () => widget.onSelectComplaintSeat(null),
                        style: OutlinedButton.styleFrom(
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                          ),
                        ),
                        child: Text(t('cancel')),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}
