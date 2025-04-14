use crate::bindings::file_client::{FileClient, FileClientError};
use std::path::PathBuf;

#[derive(Default, Debug)]
pub struct NativeFileClient {
	app_dir: PathBuf,
}

impl NativeFileClient {
	pub fn try_new(app_dir: PathBuf) -> std::io::Result<Self> {
		if app_dir.is_dir() {
			Ok(Self { app_dir })
		} else {
			log::error!("Can not use given directory as app_dir");
			Err(std::io::ErrorKind::Other)?
		}
	}
}

impl FileClient for NativeFileClient {
	fn persist_content(&self, name: String, content: Vec<u8>) -> Result<(), FileClientError> {
		let full_path = self.app_dir.join(name);
		std::fs::write(&full_path, content).map_err(|e| {
			log::error!("Unable to write to file: {full_path:?}. Reason: {e:?}");
			FileClientError::Fatal
		})
	}

	fn read_content(&self, name: String) -> Result<Vec<u8>, FileClientError> {
		let full_path = self.app_dir.join(name);
		std::fs::read(&full_path).map_err(|e| {
			log::error!("Unable to write to file: {full_path:?}. Reason: {e:?}");
			FileClientError::NotFound
		})
	}
}
