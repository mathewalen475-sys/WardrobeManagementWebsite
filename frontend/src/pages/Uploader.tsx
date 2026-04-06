import { useRef, useState } from "react";
import "../styles/Uploader.css";

type UploaderProps = {
	isOpen: boolean;
	onClose: () => void;
	onUpload?: (files: File[]) => void;
};

const coverImage =
	"https://lh3.googleusercontent.com/aida-public/AB6AXuCAaG3Tk0KEuwyn0F_s1pNvsNYpeuWqjtITbRhdTS3Ob0fHy8DnoW0RNooHXnMe0sTUPMRKMlS4T41VNxZr8k9Jxkg0xQxb9LbijIpMCmxkT7RLriEQlqdj48BEIeETIpbmeikSf7wo4ZCTEUTAPyhNPuwHJQ2cbF95A0nXZY77Ly4USHn3FzoZE_wgTRf_EK_oqKleYTXsj9iWxncajsqA3NLwBL-QX2S0KvapNGsGHvYVVebi7Z-ubuKvC9hoGzGGk53QInAN-is";

function Uploader({ isOpen, onClose, onUpload }: UploaderProps) {
	const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
	const [isDragOver, setIsDragOver] = useState(false);
	const fileInputRef = useRef<HTMLInputElement | null>(null);

	const appendFiles = (incoming: FileList | null) => {
		if (!incoming || incoming.length === 0) {
			return;
		}

		const files = Array.from(incoming);
		setSelectedFiles((previous) => [...previous, ...files]);
	};

	if (!isOpen) {
		return null;
	}

	return (
		<div className="uploader-overlay" role="dialog" aria-modal="true" aria-label="Upload outfits">
			<div className="uploader-backdrop" onClick={onClose} aria-hidden="true" />

			<article className="uploader-modal">
				<div className="uploader-visual" aria-hidden="true">
					<img src={coverImage} alt="" />
					<div className="uploader-visual-shade" />
					<div className="uploader-brand">
						<span>Atelier Wadro</span>
						<div />
					</div>
				</div>

				<div className="uploader-content">
					<button type="button" className="uploader-close" onClick={onClose} aria-label="Close uploader">
						<span className="material-symbols-outlined" aria-hidden="true">
							close
						</span>
					</button>

					<header className="uploader-header">
						<h2>Add to Your Atelier</h2>
						<p>Capture a new piece for your curated collection.</p>
					</header>

					<div className="uploader-body">
						<div
							className={`uploader-dropzone ${isDragOver ? "is-drag-over" : ""}`}
							role="button"
							tabIndex={0}
							onClick={() => fileInputRef.current?.click()}
							onKeyDown={(event) => {
								if (event.key === "Enter" || event.key === " ") {
									event.preventDefault();
									fileInputRef.current?.click();
								}
							}}
							onDragOver={(event) => {
								event.preventDefault();
								setIsDragOver(true);
							}}
							onDragLeave={() => setIsDragOver(false)}
							onDrop={(event) => {
								event.preventDefault();
								setIsDragOver(false);
								appendFiles(event.dataTransfer.files);
							}}
						>
							<div className="uploader-drop-icon">
								<span className="material-symbols-outlined" aria-hidden="true">
									cloud_upload
								</span>
							</div>

							<div className="uploader-drop-text">
								<h3>Upload Files</h3>
								<p>Drag and drop or click to browse</p>
								<span>Express Upload</span>
							</div>

							<input
								ref={fileInputRef}
								type="file"
								accept="image/*"
								multiple
								onChange={(event) => appendFiles(event.target.files)}
							/>
						</div>

						<div className="uploader-secondary-actions">
							<button type="button" className="uploader-secondary-button">
								<div>
									<span className="material-symbols-outlined" aria-hidden="true">
										photo_camera
									</span>
								</div>
								<span>Camera</span>
							</button>

							<button type="button" className="uploader-secondary-button">
								<div>
									<span className="material-symbols-outlined" aria-hidden="true">
										content_paste
									</span>
								</div>
								<span>Clipboard</span>
							</button>
						</div>

						{selectedFiles.length > 0 ? (
							<p className="uploader-selection-note">{selectedFiles.length} file(s) selected</p>
						) : null}
					</div>

					<footer className="uploader-footer">
						<p>Supported: JPG, PNG, HEIC</p>

						<div className="uploader-footer-actions">
							<button
								type="button"
								className="uploader-submit"
								disabled={selectedFiles.length === 0}
								onClick={() => {
									onUpload?.(selectedFiles);
									setSelectedFiles([]);
									onClose();
								}}
							>
								Upload Selected
							</button>

							<button
								type="button"
								className="uploader-cancel"
								onClick={() => {
									setSelectedFiles([]);
									onClose();
								}}
							>
								Cancel
							</button>
						</div>
					</footer>
				</div>
			</article>
		</div>
	);
}

export default Uploader;
