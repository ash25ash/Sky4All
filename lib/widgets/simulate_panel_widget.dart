import 'dart:math';
import 'package:flutter/material.dart';
import '../config/ditto_config.dart';
import '../models/sky4all_models.dart';
import '../services/ditto_service.dart';
import '../services/i18n_service.dart';

class SimulatePanelWidget extends StatelessWidget {
  final DittoService ditto;
  final I18nService i18n;

  const SimulatePanelWidget({
    super.key,
    required this.ditto,
    required this.i18n,
  });

  String _randomSeat() {
    final rnd = Random();
    final row = 1 + rnd.nextInt(30);
    const letters = ['A', 'B', 'C', 'D', 'E', 'F'];
    final letter = letters[rnd.nextInt(letters.length)];
    return '$row$letter';
  }

  @override
  Widget build(BuildContext context) {
    final t = i18n.t;
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: Sky4AllPalette.card,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Wrap(
        spacing: 8,
        runSpacing: 8,
        alignment: WrapAlignment.center,
        crossAxisAlignment: WrapCrossAlignment.center,
        children: [
          Text(
            t('simulate').toUpperCase(),
            style: const TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w800,
              letterSpacing: 0.6,
              color: Sky4AllPalette.mutedForeground,
            ),
          ),
          _simButton(
            label: t('simMedical'),
            danger: true,
            onTap: () => ditto.insertRequest(
              type: RequestType.medical_emergency,
              seat: _randomSeat(),
              payload: {
                'conditions': ['asthma'],
              },
            ),
          ),
          _simButton(
            label: t('simCall'),
            onTap: () => ditto.insertRequest(
              type: RequestType.call_steward,
              seat: _randomSeat(),
            ),
          ),
          _simButton(
            label: t('simOrder'),
            onTap: () {
              final seat = _randomSeat();
              const items = [
                OrderItem(name: 'Coffee', qty: 1),
                OrderItem(name: 'Chips', qty: 1),
              ];
              ditto.insertOrder(seat: seat, items: items);
              ditto.insertRequest(
                type: RequestType.order,
                seat: seat,
                payload: {
                  'items': items.map((e) => e.toMap()).toList(),
                },
              );
            },
          ),
          _simButton(
            label: t('simComplaint'),
            onTap: () => ditto.insertSeatComplaint(
              fromSeat: _randomSeat(),
              targetSeat: _randomSeat(),
              category: 'noise',
              text: 'Simulated complaint',
            ),
          ),
          _simButton(
            label: t('simBadReview'),
            danger: true,
            onTap: () => ditto.insertFlightRating(
              seat: _randomSeat(),
              turbulence: 1,
              staffBehaviour: 1,
              cleanliness: 2,
              legroom: 1,
              bagSpace: 1,
              comment: 'Simulated very bad review',
            ),
          ),
          _simButton(
            label: t('reset'),
            isReset: true,
            onTap: () => ditto.resetAll(),
          ),
        ],
      ),
    );
  }

  Widget _simButton({
    required String label,
    required VoidCallback onTap,
    bool danger = false,
    bool isReset = false,
  }) {
    final bgColor = danger
        ? Sky4AllPalette.seatUrgent
        : isReset
            ? Sky4AllPalette.background
            : Sky4AllPalette.secondary;
    final fgColor = danger
        ? Sky4AllPalette.seatUrgentForeground
        : isReset
            ? Sky4AllPalette.foreground
            : Sky4AllPalette.secondaryForeground;

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(999),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(999),
          border: isReset ? Border.all(color: Sky4AllPalette.border) : null,
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: fgColor,
          ),
        ),
      ),
    );
  }
}
