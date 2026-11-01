import 'package:flutter/material.dart';
import '../config/ditto_config.dart';
import '../models/sky4all_models.dart';

/// Exact port of `src/components/SeatMap.tsx`
/// Cabin plan: rows 1-30, seats A-F with an aisle between C and D.
class SeatMapWidget extends StatelessWidget {
  static const int rows = 30;
  static const List<String> letters = ['A', 'B', 'C', 'D', 'E', 'F'];

  final SeatStatus Function(String seat) getStatus;
  final void Function(String seat)? onSeatClick;
  final String? selectedSeat;
  final bool compact;

  const SeatMapWidget({
    super.key,
    required this.getStatus,
    this.onSeatClick,
    this.selectedSeat,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    final double boxSize = compact ? 24.0 : 32.0;
    final double fontSize = compact ? 9.0 : 10.0;
    final double headerFontSize = compact ? 8.0 : 10.0;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        // Column headers (A B C  aisle  D E F)
        Padding(
          padding: const EdgeInsets.only(bottom: 4),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              ...letters.sublist(0, 3).map(
                    (l) => SizedBox(
                      width: boxSize + 4,
                      height: boxSize,
                      child: Center(
                        child: Text(
                          l,
                          style: TextStyle(
                            fontSize: headerFontSize,
                            fontWeight: FontWeight.w700,
                            color: Sky4AllPalette.mutedForeground,
                          ),
                        ),
                      ),
                    ),
                  ),
              const SizedBox(width: 20),
              ...letters.sublist(3).map(
                    (l) => SizedBox(
                      width: boxSize + 4,
                      height: boxSize,
                      child: Center(
                        child: Text(
                          l,
                          style: TextStyle(
                            fontSize: headerFontSize,
                            fontWeight: FontWeight.w700,
                            color: Sky4AllPalette.mutedForeground,
                          ),
                        ),
                      ),
                    ),
                  ),
            ],
          ),
        ),
        // 30 rows
        ...List.generate(rows, (i) {
          final rowNum = i + 1;
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 2),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                ...letters.sublist(0, 3).map(
                      (l) => Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 2),
                        child: _buildSeatButton(
                          seatCode: '$rowNum$l',
                          letter: l,
                          boxSize: boxSize,
                          fontSize: fontSize,
                        ),
                      ),
                    ),
                SizedBox(
                  width: 20,
                  child: Center(
                    child: Text(
                      '$rowNum',
                      style: TextStyle(
                        fontSize: headerFontSize,
                        fontWeight: FontWeight.w600,
                        color: Sky4AllPalette.mutedForeground,
                      ),
                    ),
                  ),
                ),
                ...letters.sublist(3).map(
                      (l) => Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 2),
                        child: _buildSeatButton(
                          seatCode: '$rowNum$l',
                          letter: l,
                          boxSize: boxSize,
                          fontSize: fontSize,
                        ),
                      ),
                    ),
              ],
            ),
          );
        }),
      ],
    );
  }

  Widget _buildSeatButton({
    required String seatCode,
    required String letter,
    required double boxSize,
    required double fontSize,
  }) {
    final status = getStatus(seatCode);
    final isSelected =
        selectedSeat != null && seatsMatch(selectedSeat!, seatCode);

    Color bgColor;
    Color fgColor;
    switch (status) {
      case SeatStatus.ok:
        bgColor = Sky4AllPalette.seatOk;
        fgColor = Sky4AllPalette.seatOkForeground;
        break;
      case SeatStatus.minor:
        bgColor = Sky4AllPalette.seatMinor;
        fgColor = Sky4AllPalette.seatMinorForeground;
        break;
      case SeatStatus.urgent:
        bgColor = Sky4AllPalette.seatUrgent;
        fgColor = Sky4AllPalette.seatUrgentForeground;
        break;
      case SeatStatus.own:
        bgColor = Sky4AllPalette.seatOwn;
        fgColor = Sky4AllPalette.seatOwnForeground;
        break;
      case SeatStatus.idle:
        bgColor = Sky4AllPalette.muted;
        fgColor = Sky4AllPalette.mutedForeground;
        break;
    }

    return InkWell(
      onTap: onSeatClick != null ? () => onSeatClick!(seatCode) : null,
      borderRadius: BorderRadius.circular(6),
      child: Container(
        width: boxSize,
        height: boxSize,
        decoration: BoxDecoration(
          color: bgColor,
          borderRadius: BorderRadius.circular(6),
          border: isSelected
              ? Border.all(color: Sky4AllPalette.foreground, width: 2)
              : status == SeatStatus.own
                  ? Border.all(
                      color: Sky4AllPalette.seatOwnForeground.withOpacity(0.5),
                      width: 2,
                    )
                  : null,
        ),
        alignment: Alignment.center,
        child: Text(
          letter,
          style: TextStyle(
            fontSize: fontSize,
            fontWeight: FontWeight.w700,
            color: fgColor,
          ),
        ),
      ),
    );
  }
}
