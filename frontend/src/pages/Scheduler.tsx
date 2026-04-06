import { useEffect, useMemo, useState } from "react";
import "../styles/Scheduler.css";

type SchedulerProps = {
	isOpen: boolean;
	initialDate?: Date;
	onClose: () => void;
	onSchedule?: (scheduledDate: Date) => void;
};

const defaultTopImage =
	"https://lh3.googleusercontent.com/aida-public/AB6AXuCjzGGD_lTEaVGopwF2x__1OgQzh9BWhf7JQI6f-lo40L4dyWi6aA-fTbJXxXhFnz-st8oXR2NS00N51Tf2pA4OP_e8gMkGYoYK_BPh6iRfp9-ab9GYCurwJz7xpZiZaaEmn6JgmMrp9mpnYseaTE32CL6RHbWTCmfz3YiihFrFg5667rwS4xS7EA2_FCX4ttgoWgafAFvhbtRGMJg9jZ8y7wOMjBdRTM542GuCvkMrWb4n_5dCML0EyC8TCKrbPNQCH_uxIxrqnKw";

const defaultBottomImage =
	"https://lh3.googleusercontent.com/aida-public/AB6AXuDIb79V6X3c0jeefYwS01QX4NAUqbQHYjQwLwsaXVPdrWEiY2ysdGnxzkaXUg7_JnddcanQv9z4mVruVpytwx1NuPlvR7E8Tn85oTBvX7zDuPso5VCGdXahGZPYHFr6FcyygtZbKvQWNzuGK53FVPIBkW30AfhtWOq_Q00C2GUHr7T9HonkMJTQU6Bm8yU2Bc9JCa4gePd8u3M0I_C72jJXcIGyYCZnPx2CCVPtjK43XFn3llfNZ5V5sDaPAFDM36uSveD1PL-iYYA";

function formatIsoDate(date: Date) {
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(
		date.getDate()
	).padStart(2, "0")}`;
}

function Scheduler({ isOpen, initialDate, onClose, onSchedule }: SchedulerProps) {
	const defaultDate = useMemo(() => initialDate ?? new Date(), [initialDate]);
	const [selectedDate, setSelectedDate] = useState(() => formatIsoDate(defaultDate));

	useEffect(() => {
		if (isOpen) {
			setSelectedDate(formatIsoDate(defaultDate));
		}
	}, [defaultDate, isOpen]);

	if (!isOpen) {
		return null;
	}

	return (
		<div className="scheduler-overlay" role="dialog" aria-modal="true" aria-label="Schedule outfit">
			<div className="scheduler-backdrop" onClick={onClose} aria-hidden="true" />

			<div className="scheduler-modal">
				<div className="scheduler-header">
					<div>
						<h2>Schedule Outfit</h2>
						<p>Assign your curated look to a calendar date.</p>
					</div>

					<button
						type="button"
						className="scheduler-close"
						onClick={onClose}
						aria-label="Close scheduler"
					>
						<span className="material-symbols-outlined" aria-hidden="true">
							close
						</span>
					</button>
				</div>

				<div className="scheduler-images">
					<article className="scheduler-image-card">
						<img src={defaultTopImage} alt="Top piece" />
						<span>Top Piece</span>
					</article>

					<article className="scheduler-image-card">
						<img src={defaultBottomImage} alt="Bottom piece" />
						<span>Bottom Piece</span>
					</article>
				</div>

				<div className="scheduler-form-section">
					<label htmlFor="scheduler-date">Select Event Date</label>

					<div className="scheduler-date-wrap">
						<input
							id="scheduler-date"
							type="date"
							value={selectedDate}
							onChange={(event) => setSelectedDate(event.target.value)}
						/>
						<span className="material-symbols-outlined" aria-hidden="true">
							calendar_today
						</span>
					</div>
				</div>

				<div className="scheduler-actions">
					<button
						type="button"
						className="scheduler-submit"
						onClick={() => {
							if (selectedDate) {
								onSchedule?.(new Date(`${selectedDate}T00:00:00`));
							}
							onClose();
						}}
					>
						Schedule Outfit
					</button>

					<button type="button" className="scheduler-cancel" onClick={onClose}>
						Cancel and return to Atelier
					</button>
				</div>
			</div>
		</div>
	);
}

export default Scheduler;
