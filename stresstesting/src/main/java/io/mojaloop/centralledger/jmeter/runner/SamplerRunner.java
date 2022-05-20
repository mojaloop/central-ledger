package io.mojaloop.centralledger.jmeter.runner;

import io.mojaloop.centralledger.jmeter.rest.client.DFSPClient;
import io.mojaloop.centralledger.jmeter.rest.client.RESTClientException;
import io.mojaloop.centralledger.jmeter.rest.client.json.ABaseJSONObject;
import io.mojaloop.centralledger.jmeter.rest.client.json.participant.Account;
import io.mojaloop.centralledger.jmeter.rest.client.json.participant.Participant;
import io.mojaloop.centralledger.jmeter.rest.client.json.testdata.TestDataCarrier;
import io.mojaloop.centralledger.jmeter.rest.client.json.transfer.Transfer;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import lombok.ToString;
import org.apache.jmeter.samplers.SampleResult;
import org.slf4j.Logger;

import java.net.HttpURLConnection;
import java.util.Date;
import java.util.List;
import java.util.Queue;
import java.util.UUID;
import java.util.concurrent.ConcurrentLinkedQueue;
import java.util.concurrent.TimeUnit;

/**
 * Utility class used to run each of the test data types.
 *
 * @author jasonbruwer on 18/04/2020.
 * @since 1.0
 */
@RequiredArgsConstructor
public class SamplerRunner {
	private static final int QUEUE_MAX = 5000000;

	private static Queue<ValidPrepare> VALID_PREPARES = new ConcurrentLinkedQueue<>();
	private static Queue<Fulfil> PREPARE_AWAITING_COMMIT = new ConcurrentLinkedQueue<>();

	private final Logger logger;
	private final DFSPClient dfspClient;
	private final List<Participant> participants;

	@RequiredArgsConstructor
	@Getter
	@ToString
	private static class ValidPrepare {
		private final long addedAt;
		private final String payer;
		private final String payee;
		private final String transferId;
	}

	@RequiredArgsConstructor
	@Getter
	@ToString
	private static class Fulfil {
		private final long addedAt;
		private final String transferId;
	}

	public void execute(
		TestDataCarrier testData,
		SampleResult result,
		int testDataIndex
	) {
		String contentToSend = "{}";
		if (testData.getRequest() != null) contentToSend = testData.getRequest().toJsonObject().toString();

		String responseData = "Unknown";
		try {
			ABaseJSONObject responseJSON = null;
			TestDataCarrier.ActionType actionType = testData.getActionType();
			switch (actionType) {
				case create_participant:
					result.setRequestHeaders(this.createHeaderVal(actionType, "/jmeter/participants/create", testDataIndex));
					result.sampleStart();
					Participant participant = (Participant) testData.getRequest();
					responseJSON = this.dfspClient.jMeterCreateParticipant(participant);
					result.sampleEnd();


					Participant createdExistingPart = (Participant)responseJSON;
					result.setSampleLabel(String.format("%s:[%s]", result.getSampleLabel(),
							createdExistingPart.isNewlyCreated() ? "newly-created": "existing"));
				break;
				case transfer_prepare_fulfil:
				case transfer_prepare:
					Transfer transfer = (Transfer) testData.getRequest();
					transfer.setTransferId(UUID.randomUUID().toString());
					transfer.setExpiration(new Date(System.currentTimeMillis() + TimeUnit.DAYS.toMillis(1)));
					transfer.setFulfil(actionType == TestDataCarrier.ActionType.transfer_fulfil);
					//this.validateAndCorrectTransfer(transfer);

					contentToSend = transfer.toJsonObject().toString();
					result.setRequestHeaders(this.createHeaderVal(actionType, "/jmeter/transfers/", testDataIndex));
					result.sampleStart();
					responseJSON = this.dfspClient.jMeterTransferPrepare(transfer);
					result.sampleEnd();
					long timestamp = System.currentTimeMillis();
					this.addValidPrepareToQueue(new ValidPrepare(
							timestamp,
							transfer.getPayerFsp(),
							transfer.getPayeeFsp(),
							transfer.getTransferId())
					);
					if (actionType == TestDataCarrier.ActionType.transfer_prepare) {
						this.addToQueue(new Fulfil(timestamp, transfer.getTransferId()));
					}
				break;
				case transfer_fulfil:
					//TODO

				break;
				case transfer_lookup:
					result.setRequestHeaders(this.createHeaderVal(actionType, "/jmeter/participants/{name}/transfers/{id}", testDataIndex));
					if (VALID_PREPARES.isEmpty()) {
						logger.error("Please check test data. Expected a valid transfer!");
						responseData = "No valid cached prepare.";
					} else {
						ValidPrepare validPrepare = VALID_PREPARES.poll();

						while (System.currentTimeMillis() < (validPrepare.getAddedAt() + TimeUnit.SECONDS.toMillis(2))) {
							Thread.sleep(100);
						}

						contentToSend = validPrepare.toString();
						result.sampleStart();
						responseJSON = this.dfspClient.jMeterTransferLookup(validPrepare.getPayer(), validPrepare.getTransferId());
						result.sampleEnd();
					}
				break;

				default:
					throw new IllegalStateException(String.format("Action type '%s' not yet supported.", testData.getActionType()));
			}

			result.setResponseMessage(String.format("SUCCESS"));
			testData.setResponse(responseJSON);

			if (responseJSON != null) responseData = responseJSON.toJsonObject().toString();
			result.setResponseData(responseData, "UTF-8");

			result.setSuccessful(Boolean.TRUE);
			result.setResponseCode(Integer.toString(HttpURLConnection.HTTP_OK));
			result.setResponseCodeOK();
		} catch (Exception except) {
			except.printStackTrace();
			String errMsg = except.getMessage();
			if (errMsg == null) errMsg = "[Msg not set for error.]";

			result.sampleEnd();
			result.setSuccessful(Boolean.FALSE);
			this.logger.error(errMsg, except);
			result.setResponseData(errMsg, "UTF-8");
			result.setResponseMessage("ERROR-EXCEPTION ("+ testData.getActionType()+"): "+ errMsg);
			result.setSuccessful(Boolean.FALSE);
			result.setResponseCode("500");
			if (except instanceof RESTClientException) {
				RESTClientException casted = (RESTClientException)except;
				result.setResponseCode(String.format("%s-%d", result.getResponseCode(), casted.getErrorCode()));
			}
		} finally {
			long bodySize = contentToSend == null ? 0L : (long)contentToSend.getBytes().length;
			result.setBodySize(bodySize);
			result.setSamplerData(contentToSend);
		}
	}

	private String createHeaderVal(
			TestDataCarrier.ActionType actionType,
			String urlPostfix,
			int dataRowIndex
	) {
		return String.format("Action-Type: %s\nURL: %s\nTest Data Index: %d",
				actionType, urlPostfix, dataRowIndex);
	}

	private void addValidPrepareToQueue(ValidPrepare prepare) {
		if (VALID_PREPARES.size() > QUEUE_MAX) return;
		VALID_PREPARES.add(prepare);
	}

	private void addToQueue(Fulfil fulfil) {
		if (PREPARE_AWAITING_COMMIT.size() > QUEUE_MAX) return;
		PREPARE_AWAITING_COMMIT.add(fulfil);
	}

	private void validateAndCorrectTransfer(Transfer transfer) {
		String currency = transfer.getAmount().getCurrency();

		Participant payer = this.participants.stream()
				.filter(itm -> itm.getId().equals(transfer.getPayerFsp()))
				.findFirst()
				.orElse(null);

		Participant payee = this.participants.stream()
				.filter(itm -> itm.getId().equals(transfer.getPayeeFsp()))
				.findFirst()
				.orElse(null);

		if ((payer != null && payer.getAccounts() != null) && (payee != null && payee.getAccounts() != null)) {
			Account payerAccWithCurrency = payer.getAccounts().stream()
					.filter(itm -> itm.getCurrency().equals(currency))
					.findFirst()
					.orElse(null);
			Account payeeAccWithCurrency = payee.getAccounts().stream()
					.filter(itm -> itm.getCurrency().equals(currency))
					.findFirst()
					.orElse(null);
			if (payerAccWithCurrency == null || payeeAccWithCurrency == null) {
				Account firstAccountWhereBothMatch =
						payer.getAccounts().stream()
								.filter(itm -> {
									Account accWithCurrency = payee.getAccounts().stream()
											.filter(inner -> itm.getCurrency().equals(inner.getCurrency()))
											.findFirst()
											.orElse(null);
									return (accWithCurrency != null);
								})
								.findFirst()
								.orElse(null);
				if (firstAccountWhereBothMatch != null) {
					transfer.getAmount().setCurrency(firstAccountWhereBothMatch.getCurrency());
					logger.warn("Making use of Currency [{}] for [{}].",
							transfer.getAmount().getCurrency(),
							transfer.getTransferId());
				}
			}
		}
	}

	public static void clearQueues() {
		VALID_PREPARES.clear();
	}
}
